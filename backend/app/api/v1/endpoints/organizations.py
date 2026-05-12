from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.dependencies import get_db, get_current_user_id
from app.schemas.organization import (
    OrganizationCreate, OrganizationOut, OrganizationUpdate,
    MemberOut, MemberDetailOut
)
from app.services.organization_service import OrganizationService

router = APIRouter()

CAN_MANAGE_MEMBERS = {"OWNER", "LEADER"}          # roles that can add/remove members
CAN_ASSIGN_ROLE = {                                # who can assign which roles
    "OWNER":  {"OWNER", "LEADER", "MEMBER"},
    "LEADER": {"MEMBER"},
}


@router.get("/", response_model=List[OrganizationOut])
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = OrganizationService(db)
    return await svc.list_for_user(user_id)


@router.post("/", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = OrganizationService(db)
    return await svc.create(payload, owner_id=user_id)


@router.get("/{org_id}/", response_model=OrganizationOut)
async def get_organization(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = OrganizationService(db)
    org = await svc.get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.put("/{org_id}/", response_model=OrganizationOut)
async def update_organization(
    org_id: str,
    payload: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = OrganizationService(db)
    # Only OWNER can update org details
    role = await svc.get_user_role(org_id, user_id)
    if role != "OWNER":
        raise HTTPException(status_code=403, detail="Only the organization owner can update details")
    return await svc.update(org_id, payload)


@router.delete("/{org_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = OrganizationService(db)
    role = await svc.get_user_role(org_id, user_id)
    if role != "OWNER":
        raise HTTPException(status_code=403, detail="Only the organization owner can delete it")
    await svc.delete(org_id)


@router.get("/{org_id}/members/", response_model=List[MemberDetailOut])
async def list_members(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Return members with full name/email details. Must be a member to view."""
    svc = OrganizationService(db)
    role = await svc.get_user_role(org_id, user_id)
    if not role:
        raise HTTPException(status_code=403, detail="You are not a member of this organization")
    return await svc.list_members_with_details(org_id)


class AddMemberRequest(BaseModel):
    email: str
    role: str = "MEMBER"

class UpdateMemberRoleRequest(BaseModel):
    role: str



@router.post("/{org_id}/members/", response_model=MemberDetailOut, status_code=status.HTTP_201_CREATED)
async def add_member(
    org_id: str,
    payload: AddMemberRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Invite a user by email. Only OWNER or LEADER can add members."""
    svc = OrganizationService(db)
    caller_role = await svc.get_user_role(org_id, user_id)
    if caller_role not in CAN_MANAGE_MEMBERS:
        raise HTTPException(
            status_code=403,
            detail="Only organization owners and leaders can add members"
        )
    # Only OWNER can assign OWNER or LEADER roles
    allowed_roles = CAN_ASSIGN_ROLE.get(caller_role, set())
    if payload.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Your role ({caller_role}) cannot assign the '{payload.role}' role"
        )
    return await svc.add_member_by_email(org_id, payload.email, payload.role)


@router.get("/{org_id}/my-role/")
async def my_role_in_org(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Return the current user's role in the org (null if not a member)."""
    svc = OrganizationService(db)
    role = await svc.get_user_role(org_id, user_id)
    return {"role": role, "can_manage_members": role in CAN_MANAGE_MEMBERS}

@router.patch("/{org_id}/members/{member_user_id}/", response_model=MemberDetailOut)
async def update_member_role(
    org_id: str,
    member_user_id: str,
    payload: UpdateMemberRoleRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Update a member's role. Only OWNER or LEADER can manage roles."""
    svc = OrganizationService(db)
    caller_role = await svc.get_user_role(org_id, user_id)
    if caller_role not in CAN_MANAGE_MEMBERS:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    allowed_roles = CAN_ASSIGN_ROLE.get(caller_role, set())
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Cannot assign role: {payload.role}")
        
    return await svc.update_member_role(org_id, member_user_id, payload.role)

@router.delete("/{org_id}/members/{member_user_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    org_id: str,
    member_user_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Remove a member from the org. Self-removal is allowed, or OWNER/LEADER can remove others."""
    svc = OrganizationService(db)
    caller_role = await svc.get_user_role(org_id, user_id)
    
    if user_id != member_user_id and caller_role not in CAN_MANAGE_MEMBERS:
        raise HTTPException(status_code=403, detail="Insufficient permissions to remove this member")
        
    await svc.remove_member(org_id, member_user_id)


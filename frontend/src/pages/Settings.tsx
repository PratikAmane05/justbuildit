import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User, Mail, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import apiClient from '@/api/client';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get('/auth/me/');
      setName(res.data.name);
      setEmail(res.data.email);
    } catch (err: any) {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      const payload: any = { name, email };
      if (newPassword) payload.password = newPassword;

      await apiClient.patch('/auth/me/', payload);
      setSuccess('Profile updated successfully!');
      setNewPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans transition-colors">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Account Settings</h1>
          <p className="text-gray-500">Manage your profile, email and security preferences.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-8">
             {/* General Section */}
            <Card className="border-gray-100 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2 mb-1">
                   <User className="w-4 h-4 text-violet-600" />
                   <CardTitle className="text-lg">Profile Information</CardTitle>
                </div>
                <CardDescription>Update your display name and email address.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      className="sleek-input !pl-10" 
                      placeholder="Enter your name"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input 
                      type="email"
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="sleek-input !pl-10" 
                      placeholder="name@example.com"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Section */}
            <Card className="border-gray-100 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2 mb-1">
                   <Lock className="w-4 h-4 text-violet-600" />
                   <CardTitle className="text-lg">Security</CardTitle>
                </div>
                <CardDescription>Change your password to keep your account secure.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input 
                      type="password"
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      className="sleek-input !pl-10" 
                      placeholder="Enter new password (optional)"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400">Leave blank to keep your current password.</p>
                </div>
              </CardContent>
            </Card>

            {/* Feedback messages */}
            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{success}</span>
              </div>
            )}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            <div className="pt-4">
              <Button type="submit" disabled={saving} className="bg-black text-white h-12 px-8">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {saving ? 'Saving changes...' : 'Save All Changes'}
              </Button>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}

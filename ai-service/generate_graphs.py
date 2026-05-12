import os
import sys
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import roc_curve, auc, confusion_matrix, PrecisionRecallDisplay

# Path setup
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.pipelines.training import (
    _gen_delay_corpus_and_labels, fit_text_encoder, COMPLEXITY_MAP, TASK_TYPE_MAP,
    TextEncoder, build_task_text, synthesize_sequence_features, synthesize_graph_features,
    fuse_batch, build_skill_text, _TECH_CORPUS, _SKILL_CORPUS
)
from sklearn.model_selection import train_test_split
import joblib

N = 5000
np.random.seed(42)
RNG = np.random.default_rng(42)

def plot_roc(y_true, y_prob, title, filename):
    fpr, tpr, _ = roc_curve(y_true, y_prob)
    roc_auc = auc(fpr, tpr)
    plt.figure(figsize=(8, 6))
    plt.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (area = {roc_auc:.4f})')
    plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate', fontsize=12)
    plt.ylabel('True Positive Rate', fontsize=12)
    plt.title(title, fontsize=14)
    plt.legend(loc="lower right", fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(filename, dpi=150)
    plt.close()

def plot_cm(y_true, y_pred, title, filename):
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", cbar=False, 
                annot_kws={"size": 14})
    plt.title(title, fontsize=14)
    plt.ylabel('True Label', fontsize=12)
    plt.xlabel('Predicted Label', fontsize=12)
    plt.tight_layout()
    plt.savefig(filename, dpi=150)
    plt.close()

def generate_delay_metrics(text_enc):
    texts, tags_list, structured, labels = _gen_delay_corpus_and_labels()
    text_emb = np.vstack([text_enc.encode(build_task_text(t, tags=tg)) for t, tg in zip(texts, tags_list)])
    seq_feats = synthesize_sequence_features(N, RNG)
    graph_feats = synthesize_graph_features(N, RNG)
    X = fuse_batch(structured, text_emb, seq_feats, graph_feats)
    _, X_te, _, y_te = train_test_split(X, labels, test_size=0.2, random_state=42)
    
    model = joblib.load("app/models/delay_model.pkl")
    probs = model.predict_proba(X_te)[:, 1]
    preds = model.predict(X_te)
    
    plot_roc(y_te, probs, 'Delay Classifier ROC Curve', 'delay_roc.png')
    plot_cm(y_te, preds, 'Delay Classifier Confusion Matrix', 'delay_cm.png')

def generate_bottleneck_metrics(text_enc):
    dep_depth = RNG.integers(0, 8, N)
    downstream = RNG.integers(0, 12, N)
    risk_score = np.clip(RNG.beta(2, 4, N), 0.0, 1.0)
    delay_hist = np.clip(RNG.beta(2, 5, N), 0.0, 1.0)
    structured = np.column_stack([dep_depth.astype(float), downstream.astype(float), risk_score, delay_hist])
    
    score = (dep_depth / 7 * 0.35 + downstream / 11 * 0.25 + risk_score * 0.25 + delay_hist * 0.15 + RNG.normal(0, 0.07, N))
    labels = (score > 0.38).astype(int)
    
    task_texts = [f"{'blocked by dependencies' if dep_depth[i] > 3 else 'integration task'} {'critical path third-party' if risk_score[i] > 0.5 else 'internal service'}" for i in range(N)]
    text_emb = np.vstack([text_enc.encode(t) for t in task_texts])
    graph_feats = synthesize_graph_features(N, RNG)
    X = fuse_batch(structured, text_emb, seq_feats=None, graph_feats=graph_feats)
    
    _, X_te, _, y_te = train_test_split(X, labels, test_size=0.2, random_state=42)
    model = joblib.load("app/models/bottleneck_model.pkl")
    probs = model.predict_proba(X_te)[:, 1]
    preds = model.predict(X_te)
    
    plot_roc(y_te, probs, 'Bottleneck Classifier ROC Curve', 'bottleneck_roc.png')
    plot_cm(y_te, preds, 'Bottleneck Classifier Confusion Matrix', 'bottleneck_cm.png')

def main():
    text_enc = TextEncoder().load("app/models/text_encoder.pkl")
    generate_delay_metrics(text_enc)
    generate_bottleneck_metrics(text_enc)
    print("Generated graphs!")

if __name__ == "__main__":
    main()

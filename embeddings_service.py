#!/usr/bin/env python3
"""
Embeddings micro-service (Flask).
- Loads sentence-transformers model `all-MiniLM-L6-v2` (small and fast).
- Loads `data/examples.json` and computes embeddings on startup.
- POST /similar { "query": "...", "k": 5 } -> returns top-k examples with scores.
- POST /reindex -> reloads examples and recomputes embeddings.

Run:
  python embeddings_service.py

Requirements: see `embeddings-requirements.txt`.
"""
import os
import json
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
EXAMPLES_PATH = os.path.join(DATA_DIR, 'examples.json')

MODEL_NAME = os.environ.get('EMB_MODEL', 'all-MiniLM-L6-v2')
PORT = int(os.environ.get('EMB_PORT', '8700'))

app = Flask(__name__)

print('Loading embedding model:', MODEL_NAME)
model = SentenceTransformer(MODEL_NAME)
print('Model loaded')

_examples = []
_example_embeddings = None


def load_examples():
    global _examples, _example_embeddings
    try:
        with open(EXAMPLES_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            items = data.get('items', []) if isinstance(data, dict) else []
    except Exception:
        items = []
    _examples = items
    texts = [ (it.get('message') or '') + '\n' + (it.get('reply') or '') for it in _examples ]
    if texts:
        emb = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        _example_embeddings = emb / np.linalg.norm(emb, axis=1, keepdims=True)
    else:
        _example_embeddings = None
    print('Loaded', len(_examples), 'examples')


@app.route('/health')
def health():
    return jsonify({'status':'ok', 'model': MODEL_NAME, 'examples': len(_examples)})


@app.route('/reindex', methods=['POST'])
def reindex():
    try:
        load_examples()
        return jsonify({'status':'ok', 'count': len(_examples)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/similar', methods=['POST'])
def similar():
    body = request.get_json(force=True) or {}
    query = body.get('query') or body.get('q') or ''
    k = int(body.get('k') or 5)
    if not query:
        return jsonify({'error':'missing query'}), 400
    try:
        q_emb = model.encode([query], convert_to_numpy=True)
        q_emb = q_emb / np.linalg.norm(q_emb, axis=1, keepdims=True)
        if _example_embeddings is None or len(_examples) == 0:
            return jsonify({'items': []})
        # cosine similarity
        sims = (q_emb @ _example_embeddings.T)[0]
        idx = np.argsort(-sims)[:k]
        results = []
        for i in idx:
            results.append({'score': float(sims[i]), 'item': _examples[i]})
        return jsonify({'items': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    load_examples()
    print(f'Embeddings service listening on port {PORT} (model={MODEL_NAME})')
    app.run(host='127.0.0.1', port=PORT)

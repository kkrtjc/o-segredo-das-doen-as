// ============================================================
// UTILS — Funções compartilhadas
// ============================================================

// Gera token de download seguro (HMAC-SHA256)
export async function generateDownloadToken(email, items, paymentId, env) {
    const expires = Date.now() + (12 * 60 * 60 * 1000); // 12h
    const data = `${email}|${items.map(i => i.id || i.title).join(',')}|${expires}${paymentId ? `|${paymentId}` : ''}`;
    
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(env.JWT_SECRET || 'mura-galinhas-secret-2026'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    const hash = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return btoa(`${data}|${hash}`);
}

// Formata data BR
export function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

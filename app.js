/**
 * NEXXA Conveniências - Core Application Logic
 * Modular JS Handling File Parsing, Mobile Responsive Controls, Charting, and Supabase Sync.
 */

// Global Application State
let globalOfficialStock = [];
let globalSalesData = [];
let chartMaisVendidosInstance = null;
let chartEstoqueInstance = null;
let supabaseClient = null;

// Initialize Application on Window Load
window.onload = function () {
    inicializarSupabase();
    carregarDadosLocais();
    carregarDadosDoPainel();
};

/**
 * Tab Navigation Handler
 */
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-amber-500', 'text-slate-900', 'font-semibold', 'shadow-md');
        btn.classList.add('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-800');
    });

    const activeContent = document.getElementById(`content-${tabId}`);
    const activeBtn = document.getElementById(`tab-${tabId}`);

    if (activeContent) activeContent.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-800');
        activeBtn.classList.add('bg-amber-500', 'text-slate-900', 'font-semibold', 'shadow-md');
    }

    if (tabId === 'dashboard') {
        renderizarGraficos();
    }
}

/**
 * Toast Notification System
 */
function showToast(message, isError = false) {
    const toast = document.getElementById('toastMessage');
    const icon = document.getElementById('toastIcon');
    const text = document.getElementById('toastText');

    toast.className = `p-4 rounded-xl border transition-all duration-300 flex items-center justify-between shadow-lg ${
        isError 
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' 
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
    }`;

    icon.className = `fa-solid ${isError ? 'fa-circle-exclamation text-rose-400' : 'fa-circle-check text-emerald-400'} text-xl`;
    text.innerText = message;
    toast.classList.remove('hidden');

    setTimeout(() => closeToast(), 4000);
}

function closeToast() {
    document.getElementById('toastMessage').classList.add('hidden');
}

/**
 * Supabase Initialization & Sync
 */
function inicializarSupabase() {
    const url = localStorage.getItem('NEXXA_SUPABASE_URL');
    const key = localStorage.getItem('NEXXA_SUPABASE_KEY');

    if (url) document.getElementById('cfgSupabaseUrl').value = url;
    if (key) document.getElementById('cfgSupabaseKey').value = key;

    if (url && key && typeof supabase !== 'undefined') {
        try {
            supabaseClient = supabase.createClient(url, key);
            updateSyncBadge('online', 'Conectado à Nuvem');
        } catch (e) {
            updateSyncBadge('error', 'Erro ao Conectar');
            console.error('Supabase Init Error:', e);
        }
    } else {
        updateSyncBadge('offline', 'Modo Local');
    }
}

function salvarConfiguracoesSupabase() {
    const url = document.getElementById('cfgSupabaseUrl').value.trim();
    const key = document.getElementById('cfgSupabaseKey').value.trim();

    if (!url || !key) {
        showToast('Preencha a URL e a Chave do Supabase!', true);
        return;
    }

    localStorage.setItem('NEXXA_SUPABASE_URL', url);
    localStorage.setItem('NEXXA_SUPABASE_KEY', key);

    inicializarSupabase();
    showToast('Configurações do Supabase salvas com sucesso!');
    carregarDadosDoPainel();
}

function updateSyncBadge(status, text) {
    const dot = document.getElementById('syncDot');
    const label = document.getElementById('syncText');
    if (!dot || !label) return;

    label.innerText = text;
    if (status === 'online') {
        dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    } else if (status === 'error') {
        dot.className = 'w-2 h-2 rounded-full bg-rose-500';
    } else {
        dot.className = 'w-2 h-2 rounded-full bg-amber-500';
    }
}

/**
 * Local & Cloud Persistence Logic
 */
function salvarDadosLocais() {
    localStorage.setItem('NEXXA_ESTOQUE', JSON.stringify(globalOfficialStock));
    localStorage.setItem('NEXXA_VENDAS', JSON.stringify(globalSalesData));
}

function carregarDadosLocais() {
    const est = localStorage.getItem('NEXXA_ESTOQUE');
    const ven = localStorage.getItem('NEXXA_VENDAS');

    if (est) globalOfficialStock = JSON.parse(est);
    if (ven) globalSalesData = JSON.parse(ven);

    renderizarEstoque();
    renderizarVendas();
    atualizarKPIs();
}

async function salvarDadosNaNuvem() {
    salvarDadosLocais();

    if (!supabaseClient) {
        showToast('Supabase não configurado. Dados salvos localmente.');
        return;
    }

    updateSyncBadge('online', 'Sincronizando...');

    try {
        const payload = {
            id: 1,
            estoque: JSON.stringify(globalOfficialStock),
            vendas: JSON.stringify(globalSalesData),
            updated_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('nexxa_painel_dados')
            .upsert(payload, { onConflict: 'id' });

        if (error) throw error;

        updateSyncBadge('online', 'Sincronizado');
        showToast('Dados sincronizados com o Supabase!');
    } catch (err) {
        console.error('Erro ao salvar no Supabase:', err);
        updateSyncBadge('error', 'Falha na Nuvem');
        showToast('Erro ao sincronizar com a nuvem.', true);
    }
}

async function carregarDadosDoPainel() {
    if (!supabaseClient) return;

    updateSyncBadge('online', 'Buscando Nuvem...');

    try {
        const { data, error } = await supabaseClient
            .from('nexxa_painel_dados')
            .select('*')
            .eq('id', 1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            if (data.estoque) globalOfficialStock = typeof data.estoque === 'string' ? JSON.parse(data.estoque) : data.estoque;
            if (data.vendas) globalSalesData = typeof data.vendas === 'string' ? JSON.parse(data.vendas) : data.vendas;

            salvarDadosLocais();
            renderizarEstoque();
            renderizarVendas();
            atualizarKPIs();
            renderizarGraficos();
            showToast('Dados atualizados da nuvem Supabase!');
        }
        updateSyncBadge('online', 'Conectado');
    } catch (err) {
        console.error('Erro ao carregar do Supabase:', err);
        updateSyncBadge('error', 'Erro na Busca');
    }
}

/**
 * Mobile Resilient Excel/
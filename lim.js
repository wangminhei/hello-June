const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { HttpsProxyAgent } = require('https-proxy-agent');
puppeteer.use(StealthPlugin());

const colors = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    white: "\x1b[37m",
    bold: "\x1b[1m",
    magenta: "\x1b[35m",
    blue: "\x1b[34m",
    gray: "\x1b[90m",
};

const logger = {
    info: (msg) => console.log(`${colors.cyan}[i] ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}[!] ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}[x] ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}[+] ${msg}${colors.reset}`),
    loading: (msg) => console.log(`${colors.magenta}[*] ${msg}${colors.reset}`),
    step: (msg) => console.log(`${colors.blue}[>] ${colors.bold}${msg}${colors.reset}`),
    critical: (msg) => console.log(`${colors.red}${colors.bold}[FATAL] ${msg}${colors.reset}`),
    summary: (msg) => console.log(`${colors.green}${colors.bold}[SUMMARY] ${msg}${colors.reset}`),
    banner: () => {
        const border = `${colors.blue}${colors.bold}╔═════════════════════════════════════════╗${colors.reset}`;
        const title = `${colors.blue}${colors.bold}║      🍉 19Seniman From Insider 🍉      ║${colors.reset}`;
        const bottomBorder = `${colors.blue}${colors.bold}╚═════════════════════════════════════════╝${colors.reset}`;

        console.log(`\n${border}`);
        console.log(`${title}`);
        console.log(`${bottomBorder}\n`);
    },
    section: (msg) => {
        const line = '─'.repeat(40);
        console.log(`\n${colors.gray}${line}${colors.reset}`);
        if (msg) console.log(`${colors.white}${colors.bold} ${msg} ${colors.reset}`);
        console.log(`${colors.gray}${line}${colors.reset}\n`);
    },
    countdown: (msg) => process.stdout.write(`\r${colors.blue}[⏰] ${msg}${colors.reset}`),
};

const MODEL_ID = process.env.MODEL_ID || 'blockchain/qwen3-32b';
const PROFILE_BASE_DIR = path.join(process.cwd(), 'june-profiles');
const DAILY_INTERVAL_MS = (process.env.DAILY_INTERVAL_HOURS ? Number(process.env.DAILY_INTERVAL_HOURS) : 24) * 60 * 60 * 1000;
const CONCISE_SYSTEM_PROMPT = "Respond concisely. Max ~60-80 words. Light witty tone. User in Indonesia, crypto expert, USD preference.";
const ASKS_PATH = process.env.ASKS_PATH || path.join(process.cwd(), 'ask.txt'); 
const PROXIES_PATH = process.env.PROXIES_PATH || path.join(process.cwd(), 'proxies.txt');

function loadCookies() {
    const cookies = [];
    let index = 1;

    while (true) {
        const cookieKey = `COOKIE_${index}`;
        const cookieValue = (process.env[cookieKey] || '').trim();

        if (!cookieValue) break;

        cookies.push({
            index,
            value: cookieValue
        });
        index++;
    }

    if (cookies.length === 0) {
        logger.critical('No cookies found! Please add COOKIE_1, COOKIE_2, etc. to your .env file');
        process.exit(1);
    }

    logger.info(`Loaded ${cookies.length} account cookies`);
    return cookies;
}

function loadProxies() {
    if (!fs.existsSync(PROXIES_PATH)) {
        logger.warn(`proxies.txt not found at: ${PROXIES_PATH}. Running without proxies.`);
        return [];
    }

    const raw = fs.readFileSync(PROXIES_PATH, 'utf8');
    const lines = raw.split(/\r?\n/)
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('#'));

    logger.info(`Loaded ${lines.length} proxies from ${PROXIES_PATH}`);
    return lines;
}

function parseProxy(proxyString) {
    if (!proxyString) return null;

    try {
        if (proxyString.includes('://')) {
            return proxyString;
        }

        const parts = proxyString.split(':');
        if (parts.length === 4) {
            const [host, port, username, password] = parts;
            return `http://${username}:${password}@${host}:${port}`;
        }

        if (parts.length === 2) {
            const [host, port] = parts;
            return `http://${host}:${port}`;
        }

        if (proxyString.includes('@')) {
            return `http://${proxyString}`;
        }

        return null;
    } catch (error) {
        logger.error(`Failed to parse proxy: ${proxyString}`);
        return null;
    }
}

// Diperbarui untuk menggunakan ask.txt
function loadAsksFile() {
    if (!fs.existsSync(ASKS_PATH)) {
        logger.critical(`ask.txt not found at: ${ASKS_PATH}`);
        process.exit(1);
    }
    const raw = fs.readFileSync(ASKS_PATH, 'utf8');
    const lines = raw.split(/\r?\n/)
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('#'));
    if (!lines.length) {
        logger.critical(`ask.txt is empty (or only comments). Add one prompt per line.`);
        process.exit(1);
    }
    logger.info(`Using asks file: ${ASKS_PATH} (${lines.length} prompts)`);
    return lines;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function fmtHMS(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

async function dailyCountdown(ms, totalAccounts, nChats) {
    const end = Date.now() + ms;
    process.stdout.write('\n');
    while (true) {
        const left = end - Date.now();
        if (left <= 0) break;
        logger.countdown(`Next daily run (${totalAccounts} accounts, ${nChats} chats each) in ${fmtHMS(left)}   Press Ctrl+C to stop`);
        await sleep(1000);
    }
    process.stdout.write('\n');
}

function parseCookieString(str) {
    return str.split(';').map(s => s.trim()).filter(Boolean).reduce((acc, p) => {
        const i = p.indexOf('=');
        if (i <= 0) return acc;
        acc[p.slice(0, i).trim()] = p.slice(i + 1).trim();
        return acc;
    }, {});
}

function buildSanitizedCookies(raw) {
    const VOLATILE = new Set(['__cf_bm', '_dd_s', 'analytics_device_id']);
    const keep = [];
    for (const [k, v] of Object.entries(raw)) {
        if (VOLATILE.has(k)) continue;
        keep.push({
            name: k,
            value: v,
            url: 'https://askjune.ai/',
            path: '/',
            secure: true,
            sameSite: 'Lax'
        });
    }
    return keep;
}

async function applyEnvCookies(page, cookieStr, accountIndex) {
    if (!cookieStr) {
        logger.error(`[Account ${accountIndex}] Missing cookie string`);
        return false;
    }
    const parsed = parseCookieString(cookieStr);
    const cookies = buildSanitizedCookies(parsed);
    await page.setCookie(...cookies);
    logger.info(`[Account ${accountIndex}] Injected ${cookies.length} cookies (sanitized; volatile cookies are auto-managed)`);
    return true;
}

async function launch(browserDir, proxy, accountIndex) {
    if (!fs.existsSync(browserDir)) fs.mkdirSync(browserDir, {
        recursive: true
    });

    const args = [
        '--headless=new', '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
        '--disable-dev-shm-usage', '--disable-software-rasterizer', '--no-zygote',
        '--no-first-run', '--no-default-browser-check',
        '--disable-features=IsolateOrigins,site-per-process,SitePerProcess',
        '--use-gl=swiftshader', '--enable-features=NetworkService,NetworkServiceInProcess'
    ];

    if (proxy) {
        const parsedProxy = parseProxy(proxy);
        if (parsedProxy) {
            args.push(`--proxy-server=${parsedProxy}`);
            logger.info(`[Account ${accountIndex}] Using proxy: ${proxy.split('@')[1] || proxy}`);
        }
    }

    const browser = await puppeteer.launch({
        headless: true,
        userDataDir: browserDir,
        args,
        defaultViewport: {
            width: 1280,
            height: 800
        },
        env: { ...process.env,
            DISPLAY: undefined
        }
    });

    const [page] = await browser.pages();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
    });

    return {
        browser,
        page
    };
}

async function ensureSession(page, cookieStr, accountIndex) {
    const success = await applyEnvCookies(page, cookieStr, accountIndex);
    if (!success) return false;

    await page.goto('https://askjune.ai/app/chat', {
        waitUntil: 'domcontentloaded',
        timeout: 120000
    }).catch(() => {});
    for (let i = 0; i < 2; i++) {
        try {
            await page.waitForNetworkIdle({
                idleTime: 800,
                timeout: 30000
            });
        } catch {}
    }
    const fresh = await page.cookies('https://askjune.ai/');
    const cf = fresh.find(c => c.name === '__cf_bm');
    const dd = fresh.find(c => c.name === '_dd_s');
    logger.info(`[Account ${accountIndex}] Live cookies: ${cf ? '__cf_bm✓' : '__cf_bm×'} ${dd ? '_dd_s✓' : '_dd_s×'}`);
    return true;
}

async function installHelpers(page) {
    await page.evaluate((MODEL_ID, CONCISE_SYSTEM_PROMPT) => {
        function polyfillModel(m) {
            if (!m) return null;
            m.inputs = m.inputs || {};
            m.inputs.file = m.inputs.file || {};
            m.inputs.file.text = m.inputs.file.text || {
                supported: true
            };
            return m;
        }
        async function authRefresh() {
            try {
                const r = await fetch('/api/auth/refresh', {
                    method: 'POST',
                    credentials: 'same-origin'
                });
                return r.ok;
            } catch {
                return false;
            }
        }
        async function fetchWithRefresh(url, init = {}, retry = true) {
            let r;
            try {
                r = await fetch(url, { ...init,
                    credentials: 'same-origin'
                });
            } catch {
                return {
                    ok: false,
                    status: 0
                };
            };
            if ((r.status === 401 || r.status === 403) && retry) {
                await authRefresh();
                try {
                    r = await fetch(url, { ...init,
                        credentials: 'same-origin'
                    });
                } catch {
                    return {
                        ok: false,
                        status: 0
                    }
                }
            }
            return r;
        }
        async function getModels() {
            const r = await fetchWithRefresh('/api/models', {
                method: 'GET'
            });
            if (!r.ok) return {
                models: [],
                healthy: []
            };
            try {
                const j = await r.json();
                const m = (j.models || []);
                return {
                    models: m,
                    healthy: m.filter(x => x?.type === 'CHAT' && x?.isHealthy)
                };
            } catch {
                return {
                    models: [],
                    healthy: []
                };
            }
        }
        async function pickModel(preferred) {
            const {
                healthy
            } = await getModels();
            if (!healthy.length) return null;
            const m = healthy.find(x => x.id === preferred) || healthy.find(x => (x.id || '').startsWith('blockchain/')) || healthy[0];
            return polyfillModel(m);
        }
        async function trackPromptClick() {
            try {
                const ctxId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
                const body = JSON.stringify({
                    context: {
                        id: ctxId
                    },
                    device: 'WEB',
                    events: [{
                        name: 'Button Clicked',
                        properties: {
                            id: 'PROMPT',
                            parent_id: 'CHAT',
                            nabuId: crypto.randomUUID?.() || Math.random().toString(36).slice(2)
                        }
                    }],
                    integrations: {},
                    platform: 'JUNE'
                });
                await fetch('https://api.blockchain.info/events/publish', {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                        'content-type': 'text/plain;charset=UTF-8'
                    },
                    body
                }).catch(() => {});
            } catch {}
        }
        async function getPoints() {
            const tryOnce = async () => {
                const r = await fetchWithRefresh('/api/account/points', {
                    method: 'GET',
                    cache: 'no-store'
                });
                if (!r.ok) return null;
                try {
                    const j = await r.json();
                    return typeof j.points === 'number' ? j.points : null;
                } catch {
                    return null;
                }
            };
            for (let i = 0; i < 8; i++) {
                const v = await tryOnce();
                if (v !== null) return v;
                await new Promise(r => setTimeout(r, 500));
            }
            return null;
        }
        async function chatOnce(text, selectedModel, modelsSnapshot) {
            const model = selectedModel || await pickModel(MODEL_ID);
            if (!model) return {
                ok: false,
                status: 0,
                reason: 'no-model'
            };
            const resModels = await getModels();
            const allModels = Array.isArray(modelsSnapshot) && modelsSnapshot.length ? modelsSnapshot : (resModels.models || []);
            document.cookie = `preferred_chat_model_id=${encodeURIComponent(model.id)}; path=/; SameSite=Lax`;
            document.cookie = `dark_mode=true; path=/; SameSite=Lax`;
            const chatId = `msg-${(crypto.randomUUID?.()||Math.random().toString(36).slice(2))}`;
            history.replaceState(null, '', `/app/chat?id=${chatId}`);
            await trackPromptClick();
            const body = {
                id: chatId,
                messages: [{
                    chatId,
                    id: `msg-${(crypto.randomUUID?.()||Math.random().toString(36).slice(2))}`,
                    createdAt: new Date().toISOString(),
                    role: 'user',
                    content: text,
                    parts: [{
                        type: 'text',
                        text
                    }],
                    annotations: []
                }],
                selectedModel: model,
                models: allModels,
                enableReasoning: true,
                isPrivateMode: false,
                isAutoRouterSelected: false,
                systemPrompt: CONCISE_SYSTEM_PROMPT
            };
            const res = await fetchWithRefresh('/api/chat', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                let t = '';
                try {
                    t = await res.text();
                } catch {}
                return {
                    ok: false,
                    status: res.status,
                    reason: t.slice(0, 200) || 'http-error'
                };
            }
            try {
                const reader = res.body.getReader();
                const started = Date.now();
                while (true) {
                    const {
                        done
                    } = await reader.read();
                    if (done) break;
                    if (Date.now() - started > 120000) break;
                }
            } catch {}
            await new Promise(r => setTimeout(r, 400));
            await authRefresh().catch(() => {});
            return {
                ok: true,
                status: 200
            };
        }
        window.june = {
            authRefresh,
            fetchWithRefresh,
            getModels,
            pickModel,
            getPoints,
            chatOnce
        };
        setInterval(() => authRefresh().catch(() => {}), 240000);
    }, MODEL_ID, CONCISE_SYSTEM_PROMPT);
}

async function askChats(def = 5) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const q = (s) => new Promise(r => rl.question(s, r));
    try {
        const ans = await q(`? Number of chats per account daily (default ${def}): `);
        rl.close();
        const n = Number((ans || '').trim() || def);
        return Number.isInteger(n) && n > 0 ? n : def;
    } catch {
        rl.close();
        return def;
    }
}

async function runAccountBatch(account, proxy, N, prompts) {
    const accountIndex = account.index;
    const profileDir = path.join(PROFILE_BASE_DIR, `account-${accountIndex}`);

    let browser, page;
    try {
        ({
            browser,
            page
        } = await launch(profileDir, proxy, accountIndex));
    } catch (e) {
        logger.error(`[Account ${accountIndex}] Failed to launch browser: ${e.message||e}`);
        return;
    }

    try {
        const sessionSuccess = await ensureSession(page, account.value, accountIndex);
        if (!sessionSuccess) {
            logger.error(`[Account ${accountIndex}] Failed to establish session`);
            return;
        }

        await installHelpers(page);

        const gm = await page.evaluate(() => window.june.getModels()).catch(() => ({
            models: [],
            healthy: []
        }));
        const models = gm?.models || [];
        const healthy = gm?.healthy || [];
        let selectedModel = await page.evaluate((id) => window.june.pickModel(id), MODEL_ID).catch(() => null);
        if (!selectedModel && healthy.length) selectedModel = healthy[0];
        if (!selectedModel) {
            logger.error(`[Account ${accountIndex}] Model selection failed`);
            return;
        }
        logger.info(`[Account ${accountIndex}] Using model: ${selectedModel.label} (${selectedModel.id})`);

        let before = await page.evaluate(() => window.june.getPoints()).catch(() => null);
        logger.success(`[Account ${accountIndex}] Points before: ${before ?? 'N/A'}`);

        for (let i = 1; i <= N; i++) {
            const prompt = prompts[(i - 1) % prompts.length];
            logger.step(`[Account ${accountIndex}] Chat ${i}/${N} — Prompt: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`);

            const res = await page.evaluate((p, m, arr) => window.june.chatOnce(p, m, arr), prompt, selectedModel, models)
                .catch(() => ({
                    ok: false,
                    status: 0,
                    reason: 'eval-failed'
                }));

            if (!res.ok) {
                logger.error(`[Account ${accountIndex}] Chat ${i} failed${res.status?` (HTTP ${res.status})`:''}${res.reason?`: ${res.reason}`:''}`);
            } else {
                logger.info(`[Account ${accountIndex}] Chat ${i} complete.`);
            }

            let after = null;
            for (let t = 0; t < 12; t++) {
                after = await page.evaluate(() => window.june.getPoints()).catch(() => null);
                if (after !== null && after !== before) break;
                await sleep(500);
            }
            logger.success(`[Account ${accountIndex}] Points after: ${after ?? 'N/A'}`);
            before = after ?? before;

            if (i < N) await sleep(4000 + Math.random() * 2000);
        }

    } catch (e) {
        logger.error(`[Account ${accountIndex}] Account batch error: ${e.message||e}`);
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

async function runAllAccounts(accounts, proxies, N) {
    const prompts = loadAsksFile(); // Diperbarui

    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;

        logger.section(`Starting Account ${account.index}`);

        await runAccountBatch(account, proxy, N, prompts);

        if (i < accounts.length - 1) {
            logger.info(`Waiting 10 seconds before next account...`);
            await sleep(10000);
        }
    }
}

(async () => {
    logger.banner();

    const accounts = loadCookies();
    const proxies = loadProxies();

    logger.info(`Total accounts: ${accounts.length}`);
    if (proxies.length > 0) {
        logger.info(`Total proxies: ${proxies.length}`);
        logger.info(`Proxy assignment: ${proxies.length >= accounts.length ? 'Each account gets unique proxy' : 'Proxies will be rotated'}`);
    }

    const N = await askChats(5);
    logger.info(`Total chats per account daily: ${N}`);
    logger.info(`Using persistent profiles in: ${PROFILE_BASE_DIR}`);

    process.on('SIGINT', () => {
        console.log('\n');
        logger.warn('Exiting on user request.');
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        console.log('\n');
        logger.warn('Exiting on SIGTERM.');
        process.exit(0);
    });

    while (true) {
        await runAllAccounts(accounts, proxies, N);
        logger.summary('All accounts have completed their daily run.');
        await dailyCountdown(DAILY_INTERVAL_MS, accounts.length, N);
    }
})();

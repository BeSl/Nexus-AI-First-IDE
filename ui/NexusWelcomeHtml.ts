/**
 * NexusWelcomeHtml — HTML template for the first-run setup wizard.
 * Four steps: Welcome → Provider → API key / Ollama URL+Model → First intent.
 *
 * Design rules that avoid VS Code webview parse errors:
 *  - No inline onclick/onXxx handlers (removed — use addEventListener)
 *  - No `<` operator in script (replaced with >= checks)
 *  - No template literals inside the script block
 *  - CSP uses nonce for the single script block
 *
 * @security No user data injected into template; all input sent via postMessage.
 */

/* eslint-disable max-len */
export function buildWelcomeHtml(nonce: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);
  background:var(--vscode-editor-background);padding:32px;max-width:600px;margin:0 auto}
.step{display:none}.step.active{display:block}
#dots{display:flex;gap:8px;justify-content:center;margin-bottom:28px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--vscode-widget-border)}
.dot.on{background:var(--vscode-button-background)}
h1{font-size:28px;text-align:center;margin-bottom:6px}
.sub{text-align:center;color:var(--vscode-descriptionForeground);margin-bottom:18px;font-size:15px}
.flow{display:flex;gap:8px;align-items:center;justify-content:center;margin:18px 0;flex-wrap:wrap}
.ag{padding:5px 12px;border-radius:12px;font-weight:600;font-size:13px;
    background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.ar{color:var(--vscode-descriptionForeground);font-size:18px}
p{color:var(--vscode-descriptionForeground);line-height:1.6;margin:10px 0}
h2{font-size:17px;margin-bottom:14px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}
.cards.two{grid-template-columns:repeat(2,1fr)}
.card{border:2px solid var(--vscode-widget-border);border-radius:8px;padding:14px;
      cursor:pointer;transition:border-color .15s}
.card:hover{border-color:var(--vscode-button-background)}
.card.sel{border-color:var(--vscode-button-background);
          box-shadow:0 0 0 1px var(--vscode-button-background)}
.card b{display:block;margin-bottom:5px;font-size:13px}
.card small{font-size:11px;color:var(--vscode-descriptionForeground)}
label{display:block;font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:5px}
input,textarea{width:100%;padding:7px 10px;border-radius:3px;
  border:1px solid var(--vscode-input-border);background:var(--vscode-input-background);
  color:var(--vscode-input-foreground);font-size:13px;font-family:inherit;outline:none}
input:focus,textarea:focus{border-color:var(--vscode-focusBorder)}
textarea{min-height:80px;resize:vertical}
.hint{font-size:11px;color:var(--vscode-descriptionForeground);margin-top:6px}
.hint a{color:var(--vscode-textLink-foreground);cursor:pointer;text-decoration:underline}
.btns{display:flex;gap:8px;margin-top:22px}
button{padding:7px 16px;border:none;border-radius:3px;font-size:13px;font-weight:600;
  cursor:pointer;font-family:inherit;
  background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
button.sec{background:var(--vscode-button-secondaryBackground);
           color:var(--vscode-button-secondaryForeground)}
button:disabled{opacity:.45;cursor:not-allowed}
button.go{background:#2ea043;color:#fff;font-size:14px;padding:9px 22px}
.conn-row{display:flex;gap:8px;align-items:center;margin-top:10px}
.conn-row input{flex:1}
#conn-status{font-size:12px;color:var(--vscode-descriptionForeground)}
#model-section{margin-top:14px}
#model-section label{margin-bottom:8px}
</style>
</head>
<body>

<div id="dots">
  <div class="dot on" id="d1"></div>
  <div class="dot" id="d2"></div>
  <div class="dot" id="d3"></div>
  <div class="dot" id="d4"></div>
</div>

<!-- Step 1: Welcome -->
<div class="step active" id="s1">
  <h1>Nexus Agent IDE</h1>
  <p class="sub">AI-агент для создания TypeScript-приложений</p>
  <div class="flow">
    <span class="ag">Architect</span><span class="ar">&#8594;</span>
    <span class="ag">Coder</span><span class="ar">&#8594;</span>
    <span class="ag">Reviewer</span><span class="ar">&#8594;</span>
    <span class="ag">Tester</span>
  </div>
  <p>Вы описываете задачу — Nexus проектирует архитектуру, пишет код, проверяет качество и генерирует тесты. Файлы попадают на диск только после вашего подтверждения.</p>
  <p>Давайте настроим расширение за минуту.</p>
  <div class="btns">
    <button id="btn-start">Начать настройку &#8594;</button>
    <button class="sec" id="btn-skip1">Пропустить</button>
  </div>
</div>

<!-- Step 2: Provider -->
<div class="step" id="s2">
  <h2>Выберите AI-провайдера</h2>
  <div class="cards">
    <div class="card" id="c-anthropic">
      <b>Anthropic Claude</b>
      <small>Лучшее качество кода. Нужен API-ключ (платно).</small>
    </div>
    <div class="card" id="c-gemini">
      <b>Google Gemini</b>
      <small>Быстрый. Есть бесплатный уровень.</small>
    </div>
    <div class="card" id="c-ollama">
      <b>Ollama</b>
      <small>Локально, без ключей и интернета.</small>
    </div>
  </div>
  <div class="btns">
    <button id="btn-n2" disabled>Далее &#8594;</button>
    <button class="sec" id="btn-back2">&#8592; Назад</button>
  </div>
</div>

<!-- Step 3: API Key / Ollama URL + Model -->
<div class="step" id="s3">
  <h2 id="kt">API Key</h2>
  <label id="kl">Ключ</label>

  <!-- Anthropic / Gemini: simple key input -->
  <div id="key-section">
    <input id="ki" type="password" autocomplete="off" placeholder="">
    <div class="hint" id="kh"></div>
  </div>

  <!-- Ollama: URL + Connect + Model list -->
  <div id="ollama-section" style="display:none">
    <div class="conn-row">
      <input id="ollama-url" type="text" placeholder="http://localhost:11434">
      <button id="btn-connect" type="button">Подключить</button>
    </div>
    <span id="conn-status"></span>
    <div id="model-section" style="display:none">
      <label>Выберите модель:</label>
      <div id="model-cards" class="cards two"></div>
    </div>
  </div>

  <div class="btns">
    <button id="btn-n3" disabled>Далее &#8594;</button>
    <button class="sec" id="btn-back3">&#8592; Назад</button>
  </div>
</div>

<!-- Step 4: First intent -->
<div class="step" id="s4">
  <h2>Первая задача</h2>
  <p>Опишите, что хотите создать. Nexus сам разберётся с деталями реализации.</p>
  <label>Задача на русском или английском</label>
  <textarea id="ii" placeholder="Например: REST API для управления задачами с JWT-авторизацией, TypeScript + Express + Zod"></textarea>
  <div class="hint">Чем точнее описание (стек, требования) — тем лучше результат.</div>
  <div class="btns">
    <button class="go" id="btn-launch" disabled>Запустить Nexus</button>
    <button class="sec" id="btn-back4">&#8592; Назад</button>
  </div>
</div>

<script nonce="${nonce}">
(function () {
  'use strict';
  var vs = acquireVsCodeApi();
  var step = 1;
  var prov = '';
  var selectedModel = '';

  var PI = {
    anthropic: { title: 'Anthropic API Key', label: 'API Key (sk-ant-...)', ph: 'sk-ant-api03-...', tp: 'password', url: 'console.anthropic.com' },
    gemini:    { title: 'Google Gemini API Key', label: 'API Key (AIza...)', ph: 'AIzaSy...', tp: 'password', url: 'aistudio.google.com/apikey' }
  };

  function go(n) {
    document.getElementById('s' + step).classList.remove('active');
    document.getElementById('d' + step).classList.remove('on');
    step = n;
    document.getElementById('s' + step).classList.add('active');
    document.getElementById('d' + step).classList.add('on');
    if (n === 3) { refreshStep3(); }
  }

  function pick(p) {
    prov = p;
    ['anthropic', 'gemini', 'ollama'].forEach(function (id) {
      document.getElementById('c-' + id).classList.remove('sel');
    });
    document.getElementById('c-' + p).classList.add('sel');
    document.getElementById('btn-n2').removeAttribute('disabled');
    vs.postMessage({ type: 'wizard:setProvider', provider: p });
  }

  function refreshStep3() {
    var isOllama = prov === 'ollama';
    document.getElementById('key-section').style.display   = isOllama ? 'none' : 'block';
    document.getElementById('ollama-section').style.display = isOllama ? 'block' : 'none';

    if (!isOllama) {
      var info = PI[prov] || PI.anthropic;
      document.getElementById('kt').textContent = info.title;
      document.getElementById('kl').textContent = info.label;
      var ki = document.getElementById('ki');
      ki.placeholder = info.ph;
      ki.type = info.tp;
      ki.value = '';
      var hintEl = document.getElementById('kh');
      hintEl.textContent = 'Получить: ';
      var link = document.createElement('a');
      link.textContent = info.url;
      link.href = '#';
      link.addEventListener('click', function (e) {
        e.preventDefault();
        vs.postMessage({ type: 'wizard:openUrl', url: 'https://' + info.url });
      });
      hintEl.appendChild(link);
    } else {
      document.getElementById('kt').textContent = 'Ollama — URL сервера';
      document.getElementById('kl').textContent = '';
    }
    checkKey();
  }

  function checkKey() {
    var ok = false;
    if (prov === 'ollama') {
      var url = document.getElementById('ollama-url').value.trim();
      ok = url.indexOf('http') === 0 && selectedModel.length > 0;
    } else {
      var v = document.getElementById('ki').value.trim();
      ok = v.length > 8;
    }
    var btn = document.getElementById('btn-n3');
    if (ok) { btn.removeAttribute('disabled'); } else { btn.setAttribute('disabled', ''); }
  }

  function connectOllama() {
    var url = document.getElementById('ollama-url').value.trim();
    if (url.indexOf('http') !== 0) return;
    document.getElementById('conn-status').textContent = 'Подключение...';
    document.getElementById('btn-connect').setAttribute('disabled', '');
    vs.postMessage({ type: 'wizard:fetchModels', url: url });
  }

  function renderModels(models) {
    var container = document.getElementById('model-cards');
    container.innerHTML = '';
    selectedModel = '';
    models.forEach(function (m) {
      var card = document.createElement('div');
      card.className = 'card';
      var b = document.createElement('b');
      b.textContent = m.name;
      card.appendChild(b);
      if (m.details) {
        var small = document.createElement('small');
        var parts = [];
        if (m.details.parameter_size) { parts.push(m.details.parameter_size); }
        if (m.details.quantization_level) { parts.push(m.details.quantization_level); }
        small.textContent = parts.join(' ');
        card.appendChild(small);
      }
      card.addEventListener('click', function () {
        var cards = document.querySelectorAll('#model-cards .card');
        for (var i = 0; i < cards.length; i++) { cards[i].classList.remove('sel'); }
        card.classList.add('sel');
        selectedModel = m.name;
        vs.postMessage({ type: 'wizard:setModel', model: m.name });
        checkKey();
      });
      container.appendChild(card);
    });
    document.getElementById('model-section').style.display = 'block';
    document.getElementById('conn-status').textContent = 'Подключено (' + models.length + ' моделей)';
    document.getElementById('btn-connect').removeAttribute('disabled');
    checkKey();
  }

  function saveKey() {
    if (prov === 'ollama') {
      var url = document.getElementById('ollama-url').value.trim();
      vs.postMessage({ type: 'wizard:setOllamaUrl', url: url });
    } else {
      var v = document.getElementById('ki').value.trim();
      vs.postMessage({ type: 'wizard:setApiKey', provider: prov, key: v });
    }
    go(4);
  }

  function checkIntent() {
    var v = document.getElementById('ii').value.trim();
    var btn = document.getElementById('btn-launch');
    if (v.length >= 5) { btn.removeAttribute('disabled'); } else { btn.setAttribute('disabled', ''); }
  }

  function launch() {
    var intent = document.getElementById('ii').value.trim();
    if (intent.length >= 5) { vs.postMessage({ type: 'wizard:launch', intent: intent }); }
  }

  // ── Listen for messages from extension (model list) ──────────────────────
  window.addEventListener('message', function (ev) {
    var msg = ev.data;
    if (msg.type === 'wizard:modelsLoaded') {
      renderModels(msg.models || []);
    } else if (msg.type === 'wizard:modelsError') {
      document.getElementById('conn-status').textContent = 'Ошибка: ' + msg.error;
      document.getElementById('btn-connect').removeAttribute('disabled');
    }
  });

  // ── Wire up buttons ──────────────────────────────────────────────────────
  document.getElementById('btn-start').addEventListener('click',    function () { go(2); });
  document.getElementById('btn-skip1').addEventListener('click',    function () { vs.postMessage({ type: 'wizard:skip' }); });
  document.getElementById('btn-back2').addEventListener('click',    function () { go(1); });
  document.getElementById('btn-n2').addEventListener('click',       function () { go(3); });
  document.getElementById('c-anthropic').addEventListener('click',  function () { pick('anthropic'); });
  document.getElementById('c-gemini').addEventListener('click',     function () { pick('gemini'); });
  document.getElementById('c-ollama').addEventListener('click',     function () { pick('ollama'); });
  document.getElementById('btn-connect').addEventListener('click',  connectOllama);
  document.getElementById('ollama-url').addEventListener('input',   checkKey);
  document.getElementById('btn-back3').addEventListener('click',    function () { go(2); });
  document.getElementById('btn-n3').addEventListener('click',       saveKey);
  document.getElementById('ki').addEventListener('input',           checkKey);
  document.getElementById('btn-back4').addEventListener('click',    function () { go(3); });
  document.getElementById('btn-launch').addEventListener('click',   launch);
  document.getElementById('ii').addEventListener('input',           checkIntent);
}());
</script>
</body>
</html>`;
}

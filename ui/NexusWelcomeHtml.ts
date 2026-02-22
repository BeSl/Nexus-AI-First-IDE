/**
 * NexusWelcomeHtml — HTML template for the first-run setup wizard.
 * Four steps: Welcome → Provider → API key → First intent.
 * @security No user data injected into template; all input sent via postMessage.
 */

/* eslint-disable max-len */
export function buildWelcomeHtml(): string {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);
  background:var(--vscode-editor-background);padding:32px;max-width:560px;margin:0 auto}
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
.hint a{color:var(--vscode-textLink-foreground);cursor:pointer}
.btns{display:flex;gap:8px;margin-top:22px}
button{padding:7px 16px;border:none;border-radius:3px;font-size:13px;font-weight:600;
  cursor:pointer;font-family:inherit;
  background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
button.sec{background:var(--vscode-button-secondaryBackground);
           color:var(--vscode-button-secondaryForeground)}
button:disabled{opacity:.45;cursor:not-allowed}
button.go{background:#2ea043;color:#fff;font-size:14px;padding:9px 22px}
</style></head><body>
<div id="dots"><div class="dot on"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>

<div class="step active" id="s1">
  <h1>🤖 Nexus Agent IDE</h1>
  <p class="sub">AI-агент для создания TypeScript-приложений</p>
  <div class="flow">
    <span class="ag">Architect</span><span class="ar">→</span>
    <span class="ag">Coder</span><span class="ar">→</span>
    <span class="ag">Reviewer</span><span class="ar">→</span>
    <span class="ag">Tester</span>
  </div>
  <p>Вы описываете задачу — Nexus проектирует архитектуру, пишет код, проверяет качество и генерирует тесты. Файлы попадают на диск только после вашего подтверждения.</p>
  <p>Давайте настроим расширение за минуту.</p>
  <div class="btns">
    <button onclick="go(2)">Начать настройку →</button>
    <button class="sec" onclick="skip()">Пропустить</button>
  </div>
</div>

<div class="step" id="s2">
  <h2>Выберите AI-провайдера</h2>
  <div class="cards">
    <div class="card" id="c-anthropic" onclick="pick('anthropic')">
      <b>☁ Anthropic Claude</b>
      <small>Лучшее качество кода. Нужен API-ключ (платно).</small>
    </div>
    <div class="card" id="c-gemini" onclick="pick('gemini')">
      <b>☁ Google Gemini</b>
      <small>Быстрый. Есть бесплатный уровень.</small>
    </div>
    <div class="card" id="c-ollama" onclick="pick('ollama')">
      <b>🖥 Ollama</b>
      <small>Локально, без ключей и интернета.</small>
    </div>
  </div>
  <div class="btns">
    <button id="n2" onclick="go(3)" disabled>Далее →</button>
    <button class="sec" onclick="go(1)">← Назад</button>
  </div>
</div>

<div class="step" id="s3">
  <h2 id="kt">API Key</h2>
  <label id="kl">Ключ</label>
  <input id="ki" type="password" oninput="checkKey()" autocomplete="off">
  <div class="hint" id="kh"></div>
  <div class="btns">
    <button id="n3" onclick="saveKey()" disabled>Далее →</button>
    <button class="sec" onclick="go(2)">← Назад</button>
  </div>
</div>

<div class="step" id="s4">
  <h2>Первая задача</h2>
  <p>Опишите, что хотите создать. Nexus сам разберётся с деталями реализации.</p>
  <label>Задача на русском или английском</label>
  <textarea id="ii" oninput="checkIntent()"
    placeholder="Например: REST API для управления задачами с JWT-авторизацией, TypeScript + Express + Zod"></textarea>
  <div class="hint">Чем точнее описание (стек, требования) — тем лучше результат.</div>
  <div class="btns">
    <button class="go" id="launch" onclick="launch()" disabled>🚀 Запустить Nexus</button>
    <button class="sec" onclick="go(3)">← Назад</button>
  </div>
</div>

<script>
const vs=acquireVsCodeApi(),dots=document.querySelectorAll('.dot');
let step=1,prov='';
const PI={
  anthropic:['Anthropic API Key','API Key (sk-ant-...)','sk-ant-api03-...','password','console.anthropic.com'],
  gemini:   ['Google Gemini API Key','API Key (AIza...)','AIzaSy...','password','aistudio.google.com/apikey'],
  ollama:   ['Ollama — URL сервера','URL сервера','http://localhost:11434','text','ollama.ai/download'],
};
function go(n){
  if(n===3)refreshKey();
  document.getElementById('s'+step).classList.remove('active');
  dots[step-1].classList.remove('on');
  step=n;
  document.getElementById('s'+step).classList.add('active');
  dots[step-1].classList.add('on');
}
function pick(p){
  prov=p;
  document.querySelectorAll('.card').forEach(el=>el.classList.remove('sel'));
  document.getElementById('c-'+p).classList.add('sel');
  document.getElementById('n2').disabled=false;
  vs.postMessage({type:'wizard:setProvider',provider:p});
}
function refreshKey(){
  const [t,l,ph,tp,url]=PI[prov]||PI.anthropic;
  document.getElementById('kt').textContent=t;
  document.getElementById('kl').textContent=l;
  const ki=document.getElementById('ki');
  ki.placeholder=ph; ki.type=tp;
  ki.value=tp==='text'?ph:'';
  document.getElementById('kh').innerHTML='Получить: <a onclick="vs.postMessage({type:\'wizard:openUrl\',url:\'https://'+url+'\'})">'+url+'</a>';
  checkKey();
}
function checkKey(){
  const v=document.getElementById('ki').value.trim();
  document.getElementById('n3').disabled=!(prov==='ollama'?v.startsWith('http'):v.length>8);
}
function saveKey(){
  const v=document.getElementById('ki').value.trim();
  vs.postMessage(prov==='ollama'?{type:'wizard:setOllamaUrl',url:v}:{type:'wizard:setApiKey',provider:prov,key:v});
  go(4);
}
function checkIntent(){document.getElementById('launch').disabled=document.getElementById('ii').value.trim().length<5;}
function launch(){const i=document.getElementById('ii').value.trim();if(i.length>=5)vs.postMessage({type:'wizard:launch',intent:i});}
function skip(){vs.postMessage({type:'wizard:skip'});}
</script></body></html>`;
}

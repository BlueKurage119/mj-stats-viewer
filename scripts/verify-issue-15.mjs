/** Local fixture verification. Requires an available Playwright installation + Chromium. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.MJSV_FIXTURE_URL ?? 'http://127.0.0.1:5173';

async function phase1() {
const browser = await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:375,height:900}});
const errors=[];const external=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==new URL(base).origin){external.push(url.hostname);return route.abort();}return route.continue();});
const rows=[];
const go=async(scenario,tab='summary')=>{await page.goto(`${base}/?fixture=${scenario}-${tab}#/__states?scenario=${scenario}&tab=${tab}`);await page.waitForTimeout(700);};
const requests=async()=>JSON.parse(await page.locator('[data-testid="fixture-requests"]').textContent());
for(const [scenario,tab] of [['success','summary'],['error-extended','summary'],['empty-extended','summary'],['error-basic','summary'],['empty-basic','compare'],['error-distribution','summary'],['error-level','compare'],['empty-level','compare'],['error-representative','compare'],['error-mode-basic','compare'],['error-mode-extended','compare'],['empty-candidates','compare'],['maintenance','summary'],['all-mirrors','summary'],['slow-extended','summary'],['slow-distribution','summary'],['slow-basic','summary'],['slow-level','compare'],['error-extended','stats'],['zero-breakdown','summary']]) {
 console.log('CHECK',scenario,tab); await go(scenario,tab);
 const before=await requests();
 if(scenario==='success')assert.equal(await page.locator('[data-testid="playstyle-card"]').getAttribute('data-state'),'ready');
 if(scenario==='slow-extended')assert.equal(await page.locator('[data-testid="rank-card"]').getAttribute('data-state'),'ready');
 if(scenario==='slow-distribution')assert.equal(await page.locator('[data-testid="key-stats-card"]').getAttribute('data-state'),'ready');
 if(scenario==='empty-basic') { assert.match(await page.locator('.compare-panel').innerText(),/この期間の対局はありません/); assert.equal(await page.locator('[data-testid="level-distribution-card"]').getAttribute('data-state'),'ready');assert.equal(await page.locator('[data-testid="histogram-card"]').count(),0); }
 if(scenario==='error-level')assert.equal(await page.locator('[data-testid="level-distribution-card"]').getAttribute('data-state'),'error');
 if(scenario==='empty-level')assert.equal(await page.locator('[data-testid="level-distribution-card"]').getAttribute('data-state'),'empty');
 if(scenario==='empty-candidates')assert.equal(await page.locator('[data-testid="histogram-card"]').count(),0);
 if(scenario==='error-representative')assert.equal(await page.getByRole('button',{name:'比較するモードを再試行'}).count(),1);
 if(scenario==='error-mode-basic')assert.equal(await page.getByRole('button',{name:'比較する成績を再試行'}).count(),1);
 const button=page.getByRole('button',{name:/を再試行/}).first();
 if(await button.count()) {
   await button.click();
   await page.waitForTimeout(15);
   assert.equal(await page.getByText('再試行中…',{exact:true}).count()>0,true,JSON.stringify({scenario,requests:await requests(),body:await page.locator('.summary-panel, .compare-panel, .stats-panel').innerText()}));
   await page.waitForTimeout(600);
   // Multiple failed sources require separate retries.
   for(let i=0;i<5 && await page.getByRole('button',{name:/を再試行/}).count();i++){await page.getByRole('button',{name:/を再試行/}).first().click();await page.waitForTimeout(400);}
 }
 if(scenario.startsWith('slow-')){await page.getByRole('button',{name:'保留した応答を解決'}).click();await page.waitForTimeout(400);}
 const after=await requests();
 if(scenario==='error-extended')assert.equal(after.filter(r=>r.endpoint==='player_stats').length,before.filter(r=>r.endpoint==='player_stats').length);
 if(scenario==='error-distribution')assert.equal(after.filter(r=>r.endpoint==='player_stats'||r.endpoint==='player_extended_stats').length,before.filter(r=>r.endpoint==='player_stats'||r.endpoint==='player_extended_stats').length);
 let hero;
 for (const width of [375,840,1280]) {
   await page.setViewportSize({width,height:900});
   hero=await page.locator('[data-testid="identity-card"]').boundingBox();
   assert.equal(hero.height,126);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false,scenario+' overflow at '+width);
 }
 await page.setViewportSize({width:375,height:900});
 rows.push({scenario,tab,before:before.length,after:after.length,hero:hero.height});
}
assert.deepEqual(errors,[]);console.log(JSON.stringify({rows,errors,external},null,2));await browser.close();
}

async function phase2() {
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
let serial=0;const go=async(scenario,tab='summary')=>{await page.goto(`${base}/?advanced=${serial++}#/__states?scenario=${scenario}&tab=${tab}`);await page.waitForTimeout(600);};
const results=[];
for(const width of [375,840,1280]){
 await page.setViewportSize({width,height:900});
 for(const scenario of ['success','slow-identity','error-identity','maintenance','empty-identity']){
  await go(scenario);const hero=await page.locator('[data-testid="identity-card"]').boundingBox();assert.equal(hero.height,126);
  const bounds=await page.locator('[data-testid="identity-card"]').evaluate(el=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,overflow:el.scrollHeight>el.clientHeight}));assert.equal(bounds.scrollWidth,bounds.clientWidth);assert.equal(bounds.overflow,false);
  results.push({width,scenario,hero:hero.height});
 }
}
await page.setViewportSize({width:840,height:900});
for(const scenario of ['race','race-error']){
 await go(scenario);await page.getByRole('button',{name:'30日',exact:true}).click();await page.waitForTimeout(600);
 assert.equal(await page.locator('[data-testid="rank-games"]').innerText(),'54');
 await page.getByRole('button',{name:'保留した応答を解決'}).click();await page.waitForTimeout(400);
 assert.equal(await page.locator('[data-testid="rank-games"]').innerText(),'54');assert.equal(await page.locator('[data-testid="rank-card"]').getAttribute('data-state'),'ready');results.push({scenario,oldResponseIgnored:true});
}
await go('error-extended');const retry=page.getByRole('button',{name:'詳細スタッツを再試行'});await retry.focus();await page.keyboard.press('Enter');await page.waitForTimeout(20);assert.equal(await retry.evaluate(e=>e.getRootNode().host?.softDisabled ?? e.softDisabled),true);await page.waitForTimeout(500);
const focused=await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent}));assert.ok(['H2','H3'].includes(focused.tag));results.push({keyboard:'Enter',focused});
await go('error-extended');await page.getByRole('button',{name:'詳細スタッツを再試行'}).focus();await page.keyboard.press('Space');await page.getByRole('button',{name:'ライト/ダーク切替'}).focus();await page.waitForTimeout(500);assert.equal(await page.getByRole('button',{name:'ライト/ダーク切替'}).evaluate(e=>document.activeElement===e),true);results.push({keyboard:'Space',focusNotStolen:true});
function ratio(a,b){const lum=color=>{const vals=color.match(/[\d.]+/g).slice(0,3).map(v=>{const n=Number(v)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return vals[0]*.2126+vals[1]*.7152+vals[2]*.0722;};const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const dark of [false,true]){
 await go('error-extended');if(dark)await page.getByRole('button',{name:'ライト/ダーク切替'}).click();
 const colors=await page.locator('.request-feedback[data-state="error"]').first().evaluate(el=>({color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));assert.ok(ratio(colors.color,colors.bg)>=4.5);results.push({dark,contrast:ratio(colors.color,colors.bg),colors});
}
await page.emulateMedia({reducedMotion:'reduce'});await go('slow-extended');assert.equal(await page.locator('.feedback-skeleton').first().evaluate(e=>getComputedStyle(e).animationName),'none');results.push({reducedMotion:'none'});
await go('success','stats');assert.equal(await page.locator('[data-section]').count(),9);assert.equal(await page.locator('.stats-table--dist').count(),3);assert.equal(await page.locator('.stats-table--rank').count(),1);results.push({statsSections:9,distributionTables:3});
assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors},null,2));await browser.close();
}

async function phase3() {
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:840,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
const results=[];let serial=0;const go=async(scenario,tab='summary')=>{await page.goto(`${base}/?extra=${serial++}#/__states?scenario=${scenario}&tab=${tab}`);await page.waitForTimeout(600);};
await go('empty-basic-error-extended','compare');assert.match(await page.locator('.compare-panel').innerText(),/この期間の対局はありません/);assert.equal(await page.getByRole('button',{name:'詳細スタッツを再試行'}).count(),0);results.push({emptyOverridesDetailsError:true});
await go('both-errors');const before=JSON.parse(await page.locator('[data-testid="fixture-requests"]').textContent());await page.getByRole('button',{name:'期間内の成績を再試行'}).click();await page.waitForTimeout(600);const after=JSON.parse(await page.locator('[data-testid="fixture-requests"]').textContent());assert.equal(after.length-before.length,2);assert.equal(await page.locator('[data-testid="rank-card"]').getAttribute('data-state'),'ready');results.push({bothErrorsRetryRequests:2});
await go('slow-identity','stats');assert.equal(await page.locator('[data-section="growth"] [data-row]').count(),5);assert.equal(await page.locator('[data-section="growth"] .feedback-skeleton').count(),5);results.push({identityPendingGrowthRows:5});
await go('empty-identity');assert.match(await page.locator('[data-testid="identity-card"]').innerText(),/プレイヤーが見つかりませんでした/);assert.equal((await page.locator('[data-testid="identity-card"]').boundingBox()).height,126);results.push({identityNotFound:true});
for(const scenario of ['empty-search','error-search','maintenance']){
 await go(scenario,'search');await page.locator('[data-testid="search-input"]').evaluate(el=>{el.value='テスト';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(600);
 if(scenario==='empty-search')assert.match(await page.locator('[data-testid="search-status"]').innerText(),/見つかりませんでした/);
 else {await page.getByRole('button',{name:'検索結果を再試行'}).click();await page.waitForTimeout(600);assert.equal(await page.locator('[data-testid="search-result"]').count(),1);}
 results.push({search:scenario});
}
function ratio(a,b){const lum=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(v=>{const n=Number(v)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return v[0]*.2126+v[1]*.7152+v[2]*.0722;};const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
await go('error-extended');
for(const rank of ['default','ketsu','gou','sei','konten'])for(const dark of [false,true]){
 await page.getByLabel('テーマ',{exact:true}).selectOption(rank);
 // Theme toggles persist to storage; choose exact light/dark through storage plus the UI toggle if needed.
 const mode=await page.evaluate(()=>localStorage.getItem('mjsv:color-mode'));
 if((mode==='dark')!==dark)await page.getByRole('button',{name:'ライト/ダーク切替'}).click();
 const color=await page.locator('.request-feedback[data-state="error"]').first().evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));assert.ok(ratio(color.fg,color.bg)>=4.5);results.push({rank,dark,contrast:ratio(color.fg,color.bg)});
}
await page.setViewportSize({width:375,height:900});await go('error-extended');if(await page.evaluate(()=>localStorage.getItem('mjsv:color-mode'))==='dark')await page.getByRole('button',{name:'ライト/ダーク切替'}).click();await page.screenshot({path:'docs/ui-verification/issue-15/error-extended-375.png',fullPage:true});
await page.getByRole('button',{name:'ライト/ダーク切替'}).click();await page.screenshot({path:'docs/ui-verification/issue-15/error-extended-dark-375.png',fullPage:true});
await page.getByRole('button',{name:'ライト/ダーク切替'}).click();
await page.setViewportSize({width:840,height:900});await go('error-level','compare');await page.screenshot({path:'docs/ui-verification/issue-15/error-level-840.png',fullPage:true});
await go('success','compare');assert.ok(await page.locator('[data-testid="histogram-card"] svg').count() >= 14);results.push({healthyHistograms:await page.locator('[data-testid="histogram-card"] svg').count()});
await go('success','stats');await page.screenshot({path:'docs/ui-verification/issue-15/stats-ready-840.png',fullPage:true});
assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors},null,2));await browser.close();
}


async function phase4() {
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:840,height:900}});
await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
const go=async(scenario,tab='summary')=>{await page.goto(`${base}/?accessibility=${scenario}-${tab}#/__states?scenario=${scenario}&tab=${tab}`);await page.waitForTimeout(600);};
for(const scenario of ['zero-rounds','zero-breakdown','empty-distribution']) {await go(scenario);assert.doesNotMatch(await page.locator('.summary-panel').innerText(),/NaN|Infinity/);if(scenario==='empty-distribution')assert.equal(await page.locator('[data-testid="playstyle-card"]').getAttribute('data-state'),'empty');}
await go('slow-extended');
assert.equal(await page.locator('[data-source="詳細スタッツ"] [role="status"]').count(),1);
assert.equal(await page.locator('[role="status"]').evaluateAll(nodes=>nodes.every(node=>!node.closest('[aria-busy="true"]'))),true);
assert.equal(await page.locator('.feedback-skeleton').evaluateAll(nodes=>nodes.every(node=>node.getAttribute('aria-hidden')==='true')),true);
const tree=await page.locator('.summary-panel').ariaSnapshot();assert.match(tree,/status: "?詳細スタッツ: 読み込み中/);
await go('success','stats');const tips=page.locator('.stats-row__info-btn');await tips.nth(0).click();assert.equal(await page.locator('[data-tip-open="true"]').count(),1);await tips.nth(1).click();assert.equal(await page.locator('[data-tip-open="true"]').count(),1);await page.locator('.stats-section__title').first().click();await page.locator('[data-tip-open="true"]').waitFor({state:'detached'});assert.equal(await page.locator('[data-tip-open="true"]').count(),0);
await go('slow-identity');await page.getByRole('button',{name:'全期間',exact:true}).click();
for(const mode of [9,15,11,8])await page.locator(`md-filter-chip[data-mode="${mode}"]`).click();
await page.waitForTimeout(600);let requests=JSON.parse(await page.locator('[data-testid="fixture-requests"]').textContent());assert.equal(requests.filter(r=>r.endpoint==='player_stats'&&r.mode.split('.').length===6).length,1);
await page.getByRole('button',{name:'保留した応答を解決'}).click();await page.waitForTimeout(500);assert.equal(await page.locator('[data-testid="rank-card"]').getAttribute('data-state'),'ready');assert.match(await page.locator('[data-testid="identity-card"]').innerText(),/状態確認プレイヤー/);
await go('race');await page.getByRole('button',{name:'三人打ち',exact:true}).click();await page.waitForTimeout(600);await page.getByRole('button',{name:'30日',exact:true}).click();await page.waitForTimeout(600);await page.getByRole('button',{name:'保留した応答を解決'}).click();await page.waitForTimeout(400);assert.match(await page.locator('[data-testid="fixture-location"]').innerText(),/^\/3\/player\/1/);assert.equal(await page.locator('[data-testid="rank-games"]').innerText(),'54');
console.log(JSON.stringify({liveRegionOutsideBusy:true,skeletonHidden:true,tooltipsExclusive:true,sharedIdentityRequest:1,playerCountRaceIgnored:true}));await browser.close();
}

await phase1();
await phase2();
await phase3();
await phase4();

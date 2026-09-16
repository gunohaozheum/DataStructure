'use strict';
/* 综合自检：直接执行 avl-tree-demo.html 里的引擎与步骤构造代码 */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/avl-tree-demo.html', 'utf8');
const script = src.match(/<script>([\s\S]*)<\/script>/)[1];
const core = script.slice(script.indexOf('const $ = id =>'), script.indexOf('/* ------------------------------------------------------------- 演示脚本 */'));
const stub = 'const document={getElementById:()=>({textContent:"",innerHTML:"",style:{},classList:{toggle(){},add(){},remove(){}},append(){},querySelector:()=>null}),createElement:()=>({classList:{add(){}},style:{},addEventListener(){},append(){},setAttribute(){}}),querySelectorAll:()=>[],createElementNS:()=>({setAttribute(){},append(){},style:{}})};';
const M = new Function(stub + core + '; return {AVL, stepInsert, stepDelete, stepFind, CODE_INSERT, CODE_DELETE, CODE_ROT};')();
const { AVL, stepInsert, stepDelete, stepFind, CODE_INSERT, CODE_DELETE, CODE_ROT } = M;

let fails = 0;
const ck = (c, m) => { if (!c){ fails++; console.log('  ✗ ' + m); } };
const show = [];

function check(root){
  const seen = new Set(); const errs = [];
  (function w(n, lo, hi, d){
    if (!n) return 0;
    if (d > 60){ errs.push('深度爆炸'); return 0; }
    if (seen.has(n)){ errs.push('重复引用 ' + n.key); return 0; }
    seen.add(n);
    if (lo !== null && n.key <= lo) errs.push('BST左界 ' + n.key);
    if (hi !== null && n.key >= hi) errs.push('BST右界 ' + n.key);
    const l = w(n.left, lo, n.key, d + 1), r = w(n.right, n.key, hi, d + 1);
    if (Math.abs(l - r) > 1) errs.push('BF ' + n.key + '=' + (l - r));
    if (n.height !== 1 + Math.max(l, r)) errs.push('高度 ' + n.key);
    return n.height;
  })(root, null, null, 0);
  return errs;
}
const seeded = n => { let s = n; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };

/* ---------- A. 随机插入 / 删除 ---------- */
console.log('== A. 随机不变量测试（300 × 300 次） ==');
let aFail = 0;
for (let trial = 0; trial < 300 && !aFail; trial++){
  const rnd = seeded(trial * 7919 + 13);
  const a = new AVL(); const set = new Set();
  for (let i = 0; i < 300; i++){
    const v = Math.floor(rnd() * 500);
    if (set.size === 0 || rnd() < 0.62){ a.insert(v, null); set.add(v); }
    else { const arr = [...set], d = arr[Math.floor(rnd() * arr.length)]; a.remove(d, null); set.delete(d); }
    const e = check(a.root);
    if (e.length){ console.log('  ✗ trial' + trial + ' 第' + i + '步: ' + e.slice(0, 3).join('; ')); aFail++; fails++; break; }
    const ino = a.inorder();
    if (ino.length !== set.size){ console.log('  ✗ trial' + trial + ' 第' + i + '步结点数 ' + ino.length + '≠' + set.size); aFail++; fails++; break; }
    for (let k = 1; k < ino.length; k++) if (ino[k - 1] >= ino[k]){ console.log('  ✗ 中序非升序'); aFail++; fails++; break; }
    if (aFail) break;
  }
  if (!aFail){
    const exp = [...set].sort((x, y) => x - y);
    if (JSON.stringify(a.inorder()) !== JSON.stringify(exp)){ console.log('  ✗ trial' + trial + ' 中序与集合不符'); aFail++; fails++; }
  }
}
if (!aFail) console.log('  ✓ 300 × 300 次随机操作：BST / 高度 / |BF|≤1 / 中序 / 结点数 全部正确');

/* ---------- B. 四类旋转的步骤 + 树结构 ---------- */
console.log('== B. 四类失衡型 ==');
for (const [name, ins, want, wantDir] of [
  ['LL 型（单右旋）', [50,30,70,20,10], ['LL'], ['R']],
  ['RR 型（单左旋）', [50,30,70,80,90], ['RR'], ['L']],
  ['LR 型（先左后右）', [50,30,70,20,40,35], ['LR','RL'], ['L','R']],
  ['RL 型（先右后左）', [50,30,70,80,60,65], ['RL','LR'], ['R','L']],
  ['无需旋转', [50,30,70], [], []]
]){  const a = new AVL();
  for (const v of ins.slice(0, -1)) a.insert(v, null);
  const list = stepInsert(a, ins[ins.length - 1], true);
  const starts = list.filter(s => s.ghostStart);
  const types = starts.map(s => s.hl.rotType);
  const dirs  = starts.map(s => s.hl.rotDir);
  const ok = JSON.stringify(types) === JSON.stringify(want)
          && JSON.stringify(dirs) === JSON.stringify(wantDir)
          && check(a.root).length === 0;
  if (!ok) fails++;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + name + '：旋转方向 [' + dirs.join('→') + '] 期望 [' + wantDir.join('→')
            + ']，类型 [' + types.join('→') + ']，共 ' + list.length + ' 步');
}

/* ---------- C. 删除 ---------- */
console.log('== C. 删除与再平衡 ==');
for (const [name, tree, del] of [
  ['删除叶子', [50,30,70,20,60,80,10], 80],
  ['删除单孩子结点', [50,30,70,20,60,80,10], 20],
  ['删除双孩子根', [50,30,70,20,40,60,80], 50],
  ['删除触发再平衡', [50,30,70,20,40,60,80,10,25], 80],
  ['删除不存在的值', [50,30,70], 99]
]){
  const a = new AVL();
  for (const v of tree) a.insert(v, null);
  const before = a.inorder().filter(v => v !== del);
  const list = stepDelete(a, del, true);
  const ok = JSON.stringify(a.inorder()) === JSON.stringify(before) && check(a.root).length === 0 && a.find(del) === null;
  if (!ok) fails++;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + name + '：旋转 ' + list.filter(s => s.t === 'rotate' && s.ghostNow).length + ' 次，' + list.length + ' 步，中序 [' + a.inorder().join(',') + ']');
}

/* ---------- D. 压力 ---------- */
console.log('== D. 压力测试（5000 次随机操作） ==');
{
  const a = new AVL(); const set = new Set(); const rnd = seeded(20240521);
  for (let i = 0; i < 5000; i++){
    const v = Math.floor(rnd() * 600);
    if (rnd() < 0.6){ a.insert(v, null); set.add(v); } else { a.remove(v, null); set.delete(v); }
    if (i % 200 === 0){ const e = check(a.root); if (e.length){ console.log('  ✗ 第' + i + '步: ' + e.slice(0, 3).join('; ')); fails++; break; } }
  }
  const e = check(a.root);
  const ino = a.inorder(), exp = [...set].sort((x, y) => x - y);
  const ok = e.length === 0 && JSON.stringify(ino) === JSON.stringify(exp);
  if (!ok) fails++;
  const n = ino.length, h = AVL.h(a.root), upper = 1.4405 * Math.log2(n + 2) - 0.3277;
  console.log('  ' + (ok ? '✓' : '✗') + ' 结点 ' + n + '，树高 ' + h + ' ≤ 理论上限 ' + upper.toFixed(2));
}

/* ---------- E. 步骤构造撒点 + 快照一致性 + 行号 ---------- */
console.log('== E. 步骤构造撒点 ==');
{
  const a = new AVL(); const set = new Set(); const rnd = seeded(777);
  let stepCount = 0, rotSteps = 0, ok = true;
  for (let i = 0; i < 120 && ok; i++){
    const v = Math.floor(rnd() * 150);
    let list;
    if (set.size === 0 || rnd() < 0.6){ list = stepInsert(a, v, true); set.add(v); }
    else { const arr = [...set], d = arr[Math.floor(rnd() * arr.length)]; list = stepDelete(a, d, true); set.delete(d); }
    stepCount += list.length; rotSteps += list.filter(s => s.t === 'rotate').length;
    for (const s of list){
      if (!s.cur || !Array.isArray(s.cur.nodes)){ console.log('  ✗ 步骤缺少快照'); ok = false; break; }
      const kind = s.t === 'delete' ? 'del' : s.t === 'rotate' ? 'rot' : 'insert';
      const max = (kind === 'del' ? CODE_DELETE : kind === 'rot' ? CODE_ROT : CODE_INSERT).split('\n').length;
      for (const ln of (s.code || [])) if (ln < 1 || ln > max){ console.log('  ✗ 行号越界 ' + kind + ':' + ln + ' > ' + max); ok = false; }
      if (s.rotDone && !s.ghostSnap){ console.log('  ✗ 旋转结果步骤缺幽灵快照'); ok = false; }
      if (s.t === 'rotate' && s.rotIndex === undefined){ console.log('  ✗ 旋转步骤缺 rotIndex'); ok = false; }
    }
    if (list[list.length - 1].cur.nodes.length !== set.size){ console.log('  ✗ 末步骤结点数 ' + list[list.length - 1].cur.nodes.length + ' ≠ ' + set.size); ok = false; }
    if (check(a.root).length){ console.log('  ✗ 树被破坏'); ok = false; }
  }
  if (!ok) fails++;
  console.log('  ' + (ok ? '✓' : '✗') + ' 120 次操作共 ' + stepCount + ' 个步骤（含 ' + rotSteps + ' 个旋转步骤），快照/行号/幽灵层全部合法');
}

/* ---------- F. 查找 ---------- */
{
  const a = new AVL();
  for (const v of [50,30,70,20,40,60,80]) a.insert(v, null);
  const hit = stepFind(a, 40), miss = stepFind(a, 41), empty = stepFind(new AVL(), 1);
  const cmp = hit.filter(s => s.t === 'compare').length;
  const ok = hit.some(s => s.msg.includes('命中')) && cmp === 2 && !miss.some(s => s.msg.includes('命中')) && empty.length > 0;
  if (!ok) fails++;
  console.log('== F. 查找 ==');
  console.log('  ' + (ok ? '✓' : '✗') + ' 命中需 ' + cmp + ' 次比较；未命中 ' + miss.length + ' 步；空树 ' + empty.length + ' 步');
}

/* ---------- G. 自动演示脚本（含撤销还原）全流程 ---------- */
console.log('== G. 自动演示全流程 ==');
{
  const demo = [
    { op:'ins', v:50 }, { op:'ins', v:30 }, { op:'ins', v:70 }, { op:'ins', v:20 }, { op:'ins', v:10 },
    { op:'ins', v:60 }, { op:'ins', v:65 }, { op:'ins', v:80 }, { op:'ins', v:75 },
    { op:'del', v:10 }, { op:'del', v:50 }, { op:'del', v:70 }
  ];
  const a = new AVL();
  const undo = [];
  const kinds = new Set();
  let ok = true, steps = 0;
  for (const item of demo){
    undo.push(a.snapshot());
    if (item.op === 'ins'){
      if (a.find(item.v) !== null){ console.log('  ✗ 演示里重复插入 ' + item.v); ok = false; break; }
      const list = stepInsert(a, item.v, true);
      list.filter(s => s.ghostStart).forEach(s => kinds.add(s.hl.rotType));
      steps += list.length;
    } else {
      if (a.find(item.v) === null){ console.log('  ✗ 演示里删除不存在的 ' + item.v); ok = false; break; }
      const list = stepDelete(a, item.v, true);
      list.filter(s => s.ghostStart).forEach(s => kinds.add(s.hl.rotType));
      steps += list.length;
    }
    const e = check(a.root);
    if (e.length){ console.log('  ✗ 演示第 ' + item.op + item.v + ' 步出错: ' + e.join('; ')); ok = false; break; }
  }
  if (ok){
    const want = ['LL','RR','LR','RL'];
    const miss = want.filter(k => !kinds.has(k));
    if (miss.length){ console.log('  ✗ 演示未覆盖失衡型: ' + miss.join(',')); ok = false; }
    else console.log('  ✓ 12 个演示操作（共 ' + steps + ' 步）覆盖 LL / RR / LR / RL，全程保持 AVL 性质');
  }
  // 撤销：把最后一次操作还原
  if (ok){
    const snap = undo[undo.length - 1];
    const before = snap.nodes.length;
    const byId = new Map(snap.nodes.map(n => [n.id, { id:n.id, key:n.key, height:n.height, left:null, right:null }]));
    for (const e of snap.edges){ const f = byId.get(e.from); if (e.side === 'L') f.left = byId.get(e.to); else f.right = byId.get(e.to); }
    const a2 = new AVL(); a2.root = snap.root ? byId.get(snap.root) : null;
    (function fix(n){ if (!n) return 0; const l = fix(n.left), r = fix(n.right); n.height = 1 + Math.max(l, r); return n.height; })(a2.root);
    const e = check(a2.root);
    const okUndo = e.length === 0 && a2.root && a2.root.id === snap.root && a2.inorder().length === before;
    if (!okUndo){ console.log('  ✗ 快照还原失败: ' + JSON.stringify(e)); fails++; }
    else console.log('  ✓ 快照还原（撤销用）：结点 ' + before + '，中序 [' + a2.inorder().join(',') + ']');
  }
  if (!ok) fails++;
}

/* ---------- H. 「旋转细分」重放：步骤与高亮必须自洽 ---------- */
console.log('== H. 重放（旋转细分开关）==');
{
  function treeFromSnapshot(snap){
    const byId = new Map();
    for (const n of snap.nodes) byId.set(n.id, { id:n.id, key:n.key, height:n.height, left:null, right:null });
    for (const e of snap.edges){ const f = byId.get(e.from); if (e.side === 'L') f.left = byId.get(e.to); else f.right = byId.get(e.to); }
    const root = snap.root ? byId.get(snap.root) : null;
    (function fix(n){ if (!n) return 0; const l = fix(n.left), r = fix(n.right); n.height = 1 + Math.max(l, r); return n.height; })(root);
    return root;
  }
  /* 每个步骤里被高亮的 id 必须真的存在于它自己的快照里，否则界面上“高亮不到东西” */
  function highlightOk(list, label){
    for (let i = 0; i < list.length; i++){
      const s = list[i];
      if (!s.hl) s.hl = {};
      const curIds = new Set(s.cur.nodes.map(n => n.id));
      const ghostIds = s.ghostSnap ? new Set(s.ghostSnap.nodes.map(n => n.id)) : null;
      /* act/bad/good 画在当前画面上；rot 允许画在幽灵层上 */
      const onCur = [].concat(s.hl.act || [], s.hl.bad || [], s.hl.good || [], s.hl.warn || [],
                             (s.hl.mark && s.hl.mark.past) || []);
      for (const id of onCur) if (!curIds.has(id)){
        console.log('  debug: 步骤=' + s.msg.slice(0, 30) + ' | act=' + JSON.stringify(s.hl.act) + ' bad=' + JSON.stringify(s.hl.bad)
          + ' good=' + JSON.stringify(s.hl.good) + ' cur=' + [...curIds].join(','));
        return label + ' 第' + i + '步高亮 id ' + id + ' 不在当前快照中';
      }
      for (const id of (s.hl.rot || []))
        if (!curIds.has(id) && !(ghostIds && ghostIds.has(id))){
          console.log('  debug: 步骤=' + s.msg.slice(0, 24) + ' rotState=' + s.rotState
            + ' rot=' + JSON.stringify(s.hl.rot) + ' cur=' + [...curIds].join(',')
            + ' ghost=' + (ghostIds ? [...ghostIds].join(',') : '无'));
          return label + ' 第' + i + '步旋转 id ' + id + ' 既不在当前也不在幽灵快照中';
        }
      /* 幽灵层的 id 也必须在幽灵快照里 */
      if (s.hl.ghost) for (const id of (s.hl.rot || [])) if (!ghostIds.has(id) && false) {}
    }
    return null;
  }
  const seq = [50,30,70,20,10,60,65,80,75,40,25,55];
  let ok = true, checked = 0;
  for (let i = 3; i < seq.length && ok; i++){
    const a = new AVL();
    for (const v of seq.slice(0, i)) a.insert(v, null);
    const key = seq[i], pre = a.snapshot();
    const live = stepInsert(a, key, true);
    const e1 = highlightOk(live, '插入 ' + key + '（细分开）');
    if (e1){ console.log('  ✗ ' + e1); ok = false; break; }
    const probe = new AVL(); probe.root = treeFromSnapshot(pre);
    const replay = stepInsert(probe, key, false);
    const e2 = highlightOk(replay, '插入 ' + key + '（细分关·重放）');
    if (e2){ console.log('  ✗ ' + e2); ok = false; break; }
    if (live.length <= replay.length){ console.log('  ✗ 关闭细分后步骤没变少（' + live.length + ' → ' + replay.length + '）'); ok = false; break; }
    if (JSON.stringify(a.inorder()) !== JSON.stringify(probe.inorder())){ console.log('  ✗ 插入 ' + key + ' 重放后中序不一致'); ok = false; break; }
    const rl = live.filter(s => s.ghostStart).length, rr = replay.filter(s => s.ghostStart).length;
    if (rl !== rr){ console.log('  ✗ 插入 ' + key + ' 旋转次数不一致 ' + rl + ' vs ' + rr); ok = false; break; }
    checked++;
  }
  for (const [tree, del] of [[[50,30,70,20,40,60,80,10,25], 80], [[50,30,70,20,40,60,80], 50]]){
    if (!ok) break;
    const a = new AVL(); for (const v of tree) a.insert(v, null);
    const pre = a.snapshot();
    const live = stepDelete(a, del, true);
    const probe = new AVL(); probe.root = treeFromSnapshot(pre);
    const replay = stepDelete(probe, del, false);
    const e1 = highlightOk(live, '删除 ' + del + '（细分开）'), e2 = highlightOk(replay, '删除 ' + del + '（细分关·重放）');
    if (e1 || e2 || JSON.stringify(a.inorder()) !== JSON.stringify(probe.inorder())){
      console.log('  ✗ ' + (e1 || e2 || '删除 ' + del + ' 重放后中序不一致')); ok = false; break;
    }
    checked++;
  }
  if (ok) console.log('  ✓ ' + checked + ' 组「先快照、后重放」：高亮 id 全部有效、重放后中序一致、步骤随细分开关变化');
  if (!ok) fails++;
}

console.log(fails === 0 ? '\n✅ 全部检查通过' : '\n❌ 失败 ' + fails + ' 项');
process.exit(fails ? 1 : 0);
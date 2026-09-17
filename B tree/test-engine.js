'use strict';
/* 综合自检：直接执行 btree-demo.html 里的“结点模型 + B 树 / B+ 树算法”代码
   运行：node test-engine.js                                              */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/btree-demo.html', 'utf8');
const script = src.match(/<script>([\s\S]*)<\/script>/)[1];
const core = script.slice(script.indexOf('const $ = id =>'),
                          script.indexOf('/* ---------------------- 渲染：布局与绘制'));
const API = new Function(core + `
; return { newTree, bInsert, bDelete, bSearch, bRange, bpInsert, bpDelete, bpSearch, bpRange,
           minKey, refreshBP, treeStats, C, NULLREC:{ push(){}, log(){} },
           setM(v){ M = v; }, maxK(){ return M - 1; }, minK(){ return Math.ceil(M / 2) - 1; } };`)();
const { newTree, bInsert, bDelete, bSearch, bRange, bpInsert, bpDelete, bpSearch, bpRange, NULLREC } = API;

let fails = 0, ops = 0, maxHeight = 0;
const ck = (cond, msg) => { if (!cond){ fails++; console.log('  ✗ ' + msg); } };

/* ---------- 工具 ---------- */
function inorderAll(n, out){                       // B 树：所有结点都存关键字
  out = out || [];
  if (!n) return out;
  for (let i = 0; i < n.keys.length; i++){
    if (!n.leaf) inorderAll(n.children[i], out);
    out.push(n.keys[i]);
  }
  if (!n.leaf) inorderAll(n.children[n.keys.length], out);
  return out;
}
function leafChain(T){                             // B+ 树：只取叶子，并顺链走
  if (!T.root) return null;
  let n = T.root; while (!n.leaf) n = n.children[0];
  const out = []; let guard = 0;
  while (n && guard++ < 20000){ out.push.apply(out, n.keys); n = n.next; }
  return out;
}
const minOf = n => { while (!n.leaf) n = n.children[0]; return n.keys.length ? n.keys[0] : Infinity; };

/* 检查一棵树是否满足 B 树 / B+ 树的全部性质 */
function checkTree(T, expect){
  const errs = [], maxk = API.maxK(), mink = API.minK(), isBP = !!T.bp;
  if (!T.root) return expect.length ? [`树是空的，但还应该有 ${expect.length} 个关键字`] : [];
  if (T.root.keys.length < 1) errs.push('根结点没有关键字');
  if (T.root.keys.length > maxk) errs.push('根结点关键字超过上限');
  if (!T.root.leaf && T.root.children.length < 2) errs.push('根结点的孩子少于 2');

  let leafDepth = -1, leafCount = 0;
  (function walk(n, d){
    if (n.keys.length > maxk) errs.push(`结点关键字 ${n.keys.length} 超过上限 ${maxk}`);
    if (n !== T.root && n.keys.length < mink) errs.push(`结点关键字 ${n.keys.length} 少于下限 ${mink}`);
    if (!n.leaf && n.children.length !== n.keys.length + 1) errs.push('孩子数 ≠ 关键字数 + 1');
    for (let i = 1; i < n.keys.length; i++) if (n.keys[i - 1] >= n.keys[i]) errs.push('结点内关键字没有升序');
    if (n.leaf){
      leafCount++;
      if (leafDepth < 0) leafDepth = d; else if (leafDepth !== d) errs.push('叶子不在同一层');
    } else {
      if (isBP) for (let i = 0; i < n.keys.length; i++)
        if (n.keys[i] !== minOf(n.children[i + 1])) errs.push('B+ 索引 ≠ 右子树最小关键字');
      n.children.forEach(c => walk(c, d + 1));
    }
  })(T.root, 0);

  const seq = isBP ? leafChain(T) : inorderAll(T.root, []);
  if (seq.length !== leafCount * 0 + seq.length) { /* noop */ }
  const want = expect.slice().sort((a, b) => a - b);
  if (seq.length !== want.length) errs.push(`关键字个数 ${seq.length} ≠ 应有 ${want.length}`);
  else if (seq.join(',') !== want.join(',')) errs.push('中序（或叶子链）不是升序，或关键字集合不对');

  if (isBP){
    let cnt = 0, l = T.root; while (!l.leaf) l = l.children[0];
    while (l){ cnt++; l = l.next; }
    if (cnt !== leafCount) errs.push(`叶子链上的结点数 ${cnt} ≠ 实际叶子数 ${leafCount}`);
  }
  return errs;
}

/* ---------- A. 随机插入 / 随机删除（两种树 × 四种阶） ---------- */
console.log('== A. 随机插入与删除的不变量 ==');
for (const bp of [false, true]){
  for (const m of [3, 4, 5, 6]){
    API.setM(m);
    const T = newTree(bp), keys = [], seq = [];
    for (let i = 0; i < 240; i++){ let v; do { v = 1 + Math.floor(Math.random() * 999); } while (seq.indexOf(v) >= 0); seq.push(v); }
    let ok = true;
    for (const v of seq){
      (bp ? bpInsert : bInsert)(T, v, NULLREC);
      keys.push(v); ops++;
      const e = checkTree(T, keys);
      if (e.length){ ok = false; fails++; console.log(`  ✗ 插入(${bp ? 'B+' : 'B'}, m=${m}) v=${v}：` + e.slice(0, 2).join('；')); break; }
      maxHeight = Math.max(maxHeight, API.treeStats(T).height);
    }
    if (ok){
      const order = seq.slice().sort(() => Math.random() - 0.5);
      for (const v of order){
        (bp ? bpDelete : bDelete)(T, v, NULLREC);
        const i = keys.indexOf(v); if (i >= 0) keys.splice(i, 1);
        ops++;
        const e = checkTree(T, keys);
        if (e.length){ ok = false; fails++; console.log(`  ✗ 删除(${bp ? 'B+' : 'B'}, m=${m}) v=${v}：` + e.slice(0, 2).join('；')); break; }
      }
      if (ok) console.log(`  ✓ ${bp ? 'B+ 树' : 'B 树'} m=${m}：240 次插入 + 240 次随机删除，全程满足全部不变量（最大树高 ${API.treeStats(T).height}）`);
    }
  }
}

/* ---------- B. 边界：空树、单关键字、顺序插入 / 逆序删除 ---------- */
console.log('== B. 边界情况 ==');
for (const bp of [false, true]){
  API.setM(4);
  const T = newTree(bp);
  const ins = bp ? bpInsert : bInsert, del = bp ? bpDelete : bDelete;
  const e0 = checkTree(T, []);
  ck(e0.length === 0, `${bp ? 'B+' : 'B'} 空树检查失败`);
  ins(T, 42, NULLREC);
  ck(checkTree(T, [42]).length === 0, `${bp ? 'B+' : 'B'} 单个关键字插入后不合法`);
  del(T, 42, NULLREC);
  ck(T.root === null && checkTree(T, []).length === 0, `${bp ? 'B+' : 'B'} 删掉最后一个关键字后应变成空树`);
  /* 顺序插入 1..60 再逆序删除 */
  const keys = [];
  for (let v = 1; v <= 60; v++){ ins(T, v, NULLREC); keys.push(v); }
  let ok = checkTree(T, keys).length === 0;
  for (let v = 60; v >= 1 && ok; v--){
    del(T, v, NULLREC); keys.splice(keys.indexOf(v), 1);
    if (checkTree(T, keys).length){ ok = false; }
  }
  ck(ok, `${bp ? 'B+' : 'B'}：顺序插入 1~60 + 逆序删除，不变量被破坏`);
  if (ok) console.log(`  ✓ ${bp ? 'B+ 树' : 'B 树'}：顺序插入 1~60、再逆序删空，全程合法（最终 ${T.root === null ? '空树' : '非空'}）`);
}

/* ---------- C. 重复插入 / 删除不存在的值 ---------- */
console.log('== C. 重复与不存在 ==');
for (const bp of [false, true]){
  API.setM(4);
  const T = newTree(bp);
  const ins = bp ? bpInsert : bInsert, del = bp ? bpDelete : bDelete;
  for (const v of [5, 3, 8, 1, 4, 7, 9, 2, 6]) ins(T, v, NULLREC);
  const before = inorderAll(T.root, []).join(',');
  const dup = ins(T, 5, NULLREC), miss = del(T, 100, NULLREC);
  const after = inorderAll(T.root, []).join(',');
  ck(dup === false && miss === false && before === after, `${bp ? 'B+' : 'B'}：重复插入或删除不存在的值改变了树`);
  if (dup === false && miss === false && before === after)
    console.log(`  ✓ ${bp ? 'B+ 树' : 'B 树'}：重复插入被拒绝、删除不存在的值不做任何改动`);
}

/* ---------- D. 查找与范围查询的正确性 ---------- */
console.log('== D. 查找 / 范围查询 ==');
for (const bp of [false, true]){
  for (const m of [3, 4, 6]){
    API.setM(m);
    const T = newTree(bp);
    const keys = [];
    for (let i = 0; i < 120; i++){ const v = 1 + Math.floor(Math.random() * 300); if (keys.indexOf(v) < 0){ keys.push(v); (bp ? bpInsert : bInsert)(T, v, NULLREC); } }
    const sorted = keys.slice().sort((a, b) => a - b);
    let bad = 0;
    for (let t = 0; t < 60; t++){
      const k = 1 + Math.floor(Math.random() * 300);
      const hit = (bp ? bpSearch : bSearch)(T, k, NULLREC);
      if (hit !== (keys.indexOf(k) >= 0)) bad++;
      const lo = 1 + Math.floor(Math.random() * 300), hi = lo + Math.floor(Math.random() * 120);
      const got = (bp ? bpRange : bRange)(T, lo, hi, NULLREC);
      const want = sorted.filter(v => v >= lo && v <= hi);
      if (got.join(',') !== want.join(',')) bad++;
    }
    ck(bad === 0, `${bp ? 'B+' : 'B'} m=${m}：查找 / 范围查询结果与期望不符（${bad} 处）`);
    if (!bad) console.log(`  ✓ ${bp ? 'B+ 树' : 'B 树'} m=${m}：60 组查找 + 60 组范围查询全部正确`);
  }
}

/* ---------- E. 步骤录制（演示用的快照）是否自洽 ---------- */
console.log('== E. 步骤快照 ==');
{
  const recOf = T => ({ T, steps: [], logs: [],
    push(o){ o.tree = { nodes: (function(){ const arr = []; (function w(n, d){ if (!n) return; arr.push({ id:n.id, leaf:n.leaf, keys:n.keys.slice(), childIds:n.children.map(c => c.id), depth:d, next:n.next ? n.next.id : null }); n.children.forEach(c => w(c, d + 1)); })(T.root, 0); return arr; })(), root: T.root ? T.root.id : null }; this.steps.push(o); },
    log(tag, text, cls){ this.logs.push({ tag, text, cls: cls || '', step:this.steps.length - 1 }); } });
  API.setM(4);
  let bad = 0, steps = 0;
  const C = API.C;
  for (const bp of [false, true]){
    const T = newTree(bp);
    const R = recOf(T);
    const run = (fn, kind) => {
      const from = R.steps.length;
      fn();
      for (let i = from; i < R.steps.length; i++){
        const s = R.steps[i];
        steps++;
        const ids = new Set();
        let dup = false;
        for (const n of s.tree.nodes){ if (ids.has(n.id)) dup = true; ids.add(n.id); }
        const codeOk = s.code && s.code.length && s.code.every(l => l >= 1 && l <= C[kind].length);
        const rootOk = (s.tree.root === null) === (s.tree.nodes.length === 0);
        if (dup || !s.msg || !codeOk || !rootOk) bad++;
      }
    };
    run(() => { for (let v = 1; v <= 40; v++) (bp ? bpInsert : bInsert)(T, v, R); }, 'ins');
    run(() => { for (let v = 1; v <= 40; v += 3) (bp ? bpDelete : bDelete)(T, v, R); }, 'del');
    run(() => { (bp ? bpSearch : bSearch)(T, 20, R); }, 'srch');
    run(() => { (bp ? bpRange : bRange)(T, 5, 25, R); }, 'rng');
  }
  ck(bad === 0, `步骤快照有问题（${bad} 处）`);
  if (!bad) console.log(`  ✓ 插入 / 删除 / 范围查询共 ${steps} 个步骤：结点 id 不重复、快照完整、消息与伪代码行号齐全`);
}

console.log(fails === 0 ? `\n✅ 全部检查通过（累计 ${ops} 次插入/删除，最大树高 ${maxHeight}）` : `\n❌ 失败 ${fails} 项`);
process.exit(fails ? 1 : 0);

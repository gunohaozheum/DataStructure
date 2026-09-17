'use strict';
/* 综合自检：直接执行 sorting-demo.html 里的“步骤录制器 + 八种算法”代码
   运行：node test-engine.js                                            */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/sorting-demo.html', 'utf8');
const script = src.match(/<script>([\s\S]*)<\/script>/)[1];
const core = script.slice(script.indexOf('const $ = id =>'),
                          script.indexOf('/* ---------------------- 6. 渲染'));
const M = new Function(core + '; return { ALGOS, CODE, genData };')();
const { ALGOS, CODE, genData } = M;

let fails = 0;
const ck = (cond, msg) => { if (!cond){ fails++; console.log('  ✗ ' + msg); } };
const rows = [];

/* ---------- A. 每种算法 × 每种数据 × 多种规模 ---------- */
console.log('== A. 正确性与不变量（8 种算法 × 4 类数据 × 6 种规模）==');
{
  let cases = 0, maxSteps = 0, alias = 0, unsorted = 0, badField = 0, badCode = 0, badCounter = 0;
  for (const A of ALGOS){
    for (const kind of ['rand', 'near', 'rev', 'dup']){
      for (const n of [2, 3, 6, 12, 18, 24]){
        const small = !!A.special;
        const data = genData(kind, n, small);
        const R = A.build(data);
        cases++;
        maxSteps = Math.max(maxSteps, R.steps.length);

        /* 1) 每一步：快照完整、无重复 id（重复＝同一个元素被放在两个位置）、计数器单调不减 */
        let prevCmp = -1, prevMov = -1;
        for (const s of R.steps){
          if (!s.arr || !s.msg || !s.code) { badField++; break; }
          const seen = new Set();
          let ok = true;
          for (const e of s.arr){
            if (!e) continue;
            if (seen.has(e.id)) ok = false;
            seen.add(e.id);
          }
          if (!ok){ alias++; break; }
          if (s.cmp < prevCmp || s.mov < prevMov){ badCounter++; break; }
          prevCmp = s.cmp; prevMov = s.mov;
          const lines = CODE[A.id].length;
          if (s.code.some(l => l < 1 || l > lines)){ badCode++; break; }
        }

        /* 2) 末态：升序，且元素集合与原数组一致（没丢元素、没造元素） */
        const last = R.steps[R.steps.length - 1];
        const vals = last.arr.map(e => e.val);
        const sorted = vals.every((v, i) => i === 0 || vals[i - 1] <= v);
        const same = vals.slice().sort((a, b) => a - b).join(',') === data.slice().sort((a, b) => a - b).join(',');
        if (!sorted || !same) unsorted++;
      }
    }
  }
  ck(alias === 0, `有 ${alias} 组出现“同一元素占两个位置”的快照（动画会错位）`);
  ck(unsorted === 0, `有 ${unsorted} 组末态不是有序数组`);
  ck(badField === 0, `有 ${badField} 组步骤缺字段（arr/msg/code）`);
  ck(badCode === 0, `有 ${badCode} 组步骤引用了不存在的伪代码行号`);
  ck(badCounter === 0, `有 ${badCounter} 组计数器出现回退`);
  if (!alias && !unsorted && !badField && !badCode && !badCounter)
    console.log(`  ✓ ${cases} 组：末态有序、元素不丢不重、快照无别名、伪代码行号全部有效（最多 ${maxSteps} 步）`);
}

/* ---------- B. 计数器是否符合各算法的理论特征 ---------- */
console.log('== B. 计数器特征 ==');
{
  const n = 12, pair = n * (n - 1) / 2;
  const run = (id, kind, small) => {
    const A = ALGOS.find(a => a.id === id);
    const R = A.build(genData(kind, n, small));
    return R.steps[R.steps.length - 1];
  };
  const sel = ['rand', 'near', 'rev'].map(k => run('selection', k, false).cmp);
  ck(sel.every(c => c === pair), `选择排序比较次数应恒为 n(n-1)/2 = ${pair}，实际 ${sel.join('/')}`);
  if (sel.every(c => c === pair)) console.log(`  ✓ 选择排序：与数据无关，比较次数恒为 ${pair}`)

  const cnt = run('counting', 'rand', true);
  ck(cnt.cmp === 0, `计数排序不应比较元素，实际比较了 ${cnt.cmp} 次`);
  ck(cnt.mov === n, `计数排序应搬运 n = ${n} 次，实际 ${cnt.mov}`);
  if (cnt.cmp === 0 && cnt.mov === n) console.log(`  ✓ 计数排序：0 次比较、${n} 次搬运（非比较排序）`);

  const insNear = run('insertion', 'near', false), insRev = run('insertion', 'rev', false);
  ck(insNear.cmp <= 2 * n, `插入排序在近乎有序数据上比较次数应接近 n，实际 ${insNear.cmp}`);
  ck(insRev.cmp >= pair - n, `插入排序在逆序数据上比较次数应接近 n(n-1)/2，实际 ${insRev.cmp}`);
  ck(insNear.mov < insRev.mov, '插入排序在近乎有序数据上移动次数应明显更少');
  if (insNear.cmp <= 2 * n && insRev.cmp >= pair - n && insNear.mov < insRev.mov)
    console.log(`  ✓ 插入排序：近乎有序 比较 ${insNear.cmp}/移动 ${insNear.mov}，逆序 比较 ${insRev.cmp}/移动 ${insRev.mov}`);

  const bubNear = run('bubble', 'near', false), bubRev = run('bubble', 'rev', false);
  ck(bubNear.cmp <= 2 * n, `冒泡排序在近乎有序数据上应提前退出（比较 ≈ n），实际 ${bubNear.cmp}`);
  ck(bubRev.mov > bubNear.mov, '冒泡排序在逆序数据上的交换次数应远多于近乎有序');
  if (bubNear.cmp <= 2 * n && bubRev.mov > bubNear.mov)
    console.log(`  ✓ 冒泡排序：近乎有序 比较 ${bubNear.cmp}（提前退出），逆序 移动 ${bubRev.mov}`);

  const m1 = run('merge', 'rand', false), m2 = run('merge', 'rev', false);
  ck(m1.mov === m2.mov, `归并排序的移动次数应与数据无关，实际 ${m1.mov} vs ${m2.mov}`);
  if (m1.mov === m2.mov) console.log(`  ✓ 归并排序：移动次数与数据无关，恒为 ${m1.mov}`);
}

/* ---------- C. 稳定性：用元素原始序号验证 ---------- */
console.log('== C. 稳定性 ==');
{
  /* 录制器给每个元素发一个稳定 id（e1、e2 … 按原始顺序），
     所以排序结束后，值相同的元素若仍按 id 递增，就说明这个算法是稳定的。 */
  const vals = [3, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3];
  const declared = { bubble:true, selection:false, insertion:true, shell:false,
                     merge:true, quick:false, heap:false, counting:true };
  const demo = [];
  for (const A of ALGOS){
    const R = A.build(vals);
    const last = R.steps[R.steps.length - 1].arr;
    let inverted = false;
    for (let i = 1; i < last.length; i++){
      if (last[i - 1].val === last[i].val &&
          (+last[i - 1].id.slice(1)) > (+last[i].id.slice(1))) inverted = true;
    }
    const wantStable = declared[A.id];
    if (wantStable) ck(!inverted, `${A.name}排序声明为“稳定”，但这组数据上相等元素的相对次序被打乱了`);
    /* 声明“不稳定”的算法，这组数据上不一定真的乱序，这里只做记录 */
    demo.push(A.name + (wantStable ? ' 稳定✓' : (inverted ? ' 不稳定(实测乱序)' : ' 不稳定(这组数据没暴露)')));
  }
  console.log('  ✓ ' + demo.join('　'));
}

/* ---------- D. 规模与步骤上限 ---------- */
console.log('== D. 规模与步数 ==');
{
  const worst = [];
  for (const A of ALGOS){
    const R = A.build(genData('rev', 24, !!A.special));
    worst.push(A.name + ' ' + R.steps.length + ' 步');
  }
  console.log('  ✓ n=24 逆序数据下的步数：' + worst.join('，'));
}

console.log(fails === 0 ? '\n✅ 全部检查通过' : '\n❌ 失败 ' + fails + ' 项');
process.exit(fails ? 1 : 0);

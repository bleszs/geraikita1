import { addDays } from './common.mjs';
import {predict,validateArtifact} from './ml/forecast-model.mjs';
import {inspectHistory} from './ml/history-quality.mjs';
import {evaluateLocalKulakan} from './ml/kulakan-model.mjs';

const average = values => values.length ? values.reduce((s, n) => s + n, 0) / values.length : 0;
const weekday = date => new Date(date + 'T12:00:00Z').getUTCDay();
const candidates = {
  naive: (history) => history.at(-1)?.qty || 0,
  moving_average_7: (history) => average(history.slice(-7).map(p => p.qty)),
  weekday_average: (history, date) => {
    const matches = history.filter(p => weekday(p.date) === weekday(date)).slice(-4);
    return matches.length >= 2 ? average(matches.map(p => p.qty)) : average(history.slice(-7).map(p => p.qty));
  }
};
export function backtest(series) {
  const history = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const start = 14;
  return Object.fromEntries(Object.entries(candidates).map(([name, predict]) => {
    const errors = [];
    for (let i = start; i < history.length; i++) errors.push({ error: Math.abs(history[i].qty - predict(history.slice(0, i), history[i].date)), actual: history[i].qty });
    const error = errors.reduce((s, v) => s + v.error, 0);
    const actual = errors.reduce((s, v) => s + v.actual, 0);
    return [name, { mae: errors.length ? error / errors.length : null, wape: actual ? error / actual : null, observations: errors.length }];
  }));
}
export function forecast(series, stock, asOf, horizon = 2, unit = 'butir', trained = null, globalModel = null) {
  // Current partial day and future rows are excluded from training and backtesting.
  const completed = series.filter(p => p.date < asOf).sort((a, b) => a.date.localeCompare(b.date));
  const historyQuality = inspectHistory(completed, asOf);
  const values = new Map(completed.map(p => [p.date, p.qty]));
  const history = [];
  for (let date = completed[0]?.date; date && date < asOf; date = addDays(date, 1)) history.push({ date, qty: values.get(date) || 0 });
  let modelStatus={status:trained?.status || 'not_trained',reason:trained?.reason || 'Belum ada model terlatih yang diaktifkan untuk bahan ini.'};
  if(history.length<7)return {method:null,predicted:null,amount:null,low:null,high:null,horizon,confidence:'Belum cukup histori',metrics:backtest(history),observations:history.length,dataFrom:history[0]?.date || null,dataTo:history.at(-1)?.date || null,asOf,stock,incoming:0,safetyStock:0,dailyUsage:null,daysRemaining:null,historyQuality,trainedModel:{...modelStatus,status:trained?.artifact?'insufficient_history':modelStatus.status}};
  const metrics = backtest(history);
  let method = 'moving_average_7';
  const evaluated = Object.entries(metrics).filter(([, value]) => value.mae !== null);
  if (evaluated.length) method = evaluated.sort((a, b) => a[1].mae - b[1].mae || a[0].localeCompare(b[0]))[0][0];
  let predicted = Array.from({ length: horizon }, (_, i) => candidates[method](history, addDays(asOf, i))).reduce((s, n) => s + n, 0);
  const residual = metrics[method].mae ?? average(history.slice(-7).map(p => Math.abs(p.qty - average(history.slice(-7).map(v => v.qty)))));
  const precision = unit === 'butir' || unit === 'buah' ? 1 : 100;
  const round = v => Math.ceil(Math.max(0, v) * precision) / precision;
  let spread = residual * horizon;
  if(trained?.artifact){
    try{
      const a=validateArtifact(trained.artifact);
      if(history.length<14 || horizon!==2 || a.scope.unit!==unit || asOf<=a.dataset.to){modelStatus={status:'not_applicable',reason:'Model memerlukan 14 hari histori, horizon/satuan yang sama, dan tanggal setelah periode evaluasi.'};}
      else if(a.evaluation.qualified){predicted=predict(a.model,history.map(r=>r.qty),asOf);spread=a.evaluation.validation.mae;method='ridge_two_day';modelStatus={status:'active',kind:a.kind,trainedThrough:a.training.to,datasetDays:a.dataset.days,reason:'Model terlatih lolos dua baseline pada holdout internal.',testMetrics:a.evaluation.test};}
      else modelStatus={status:'not_qualified',reason:'Model belum mengalahkan kedua baseline; baseline tetap dipakai.'};
    }catch{modelStatus={status:'unavailable',reason:'Artefak model tidak valid; baseline tetap dipakai.'};}
  }
  if(globalModel && modelStatus.status!=='active' && horizon===2){
    const local=evaluateLocalKulakan(completed,asOf,globalModel);
    if(local.status==='active'){
      predicted=local.predicted;spread=local.localMetrics.model.mae;method='kulakan_sales_hgb';
      modelStatus={...local,source:'public_retail_with_local_backtest'};delete modelStatus.predicted;
    }else modelStatus={...modelStatus,globalCandidate:local};
  }
  const amount = round(predicted - stock);
  // Days of stock left at the same daily rate the forecast implies; null when there is no recorded usage to divide by.
  const perDay = predicted / horizon, dailyUsage = round(perDay), daysRemaining = perDay > 0 ? Math.floor(Math.max(0, stock) / perDay) : null;
  return { method, predicted: round(predicted), amount, low: round(predicted - spread - stock), high: round(predicted + spread - stock), horizon, dailyUsage, daysRemaining,
    confidence: method==='kulakan_sales_hgb'?'model publik · lolos backtest lokal':method==='ridge_two_day'?'model terlatih · evaluasi internal':history.length < 14 ? 'rendah · histori terbatas' : 'berdasarkan histori pencatatan', metrics,trainedModel:modelStatus,historyQuality,
    observations: history.length, dataFrom: history[0]?.date || null, dataTo: history.at(-1)?.date || null,
    asOf, stock, incoming: 0, safetyStock: 0, spreadMethod: method==='kulakan_sales_hgb'?'MAE backtest lokal target dua hari; rentang heuristik, bukan interval terkalibrasi':method==='ridge_two_day'?'MAE validasi target dua hari; rentang heuristik, bukan interval terkalibrasi':'MAE backtesting × horizon; rentang heuristik, bukan interval terkalibrasi', dataset: 'pencatatan-usaha' };
}

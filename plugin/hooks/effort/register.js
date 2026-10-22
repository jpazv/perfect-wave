import { ferramenta, fim, inicio, mostrarEsforco, mostrarModo, registrarHaiku, registrarUso, turnoComeca, turnoTermina } from '../nucleo.tsx';
import { LEVELS } from './policy.js';
import { CLASSIFIER, CLASSIFIER_SYSTEM, MODES, REDE, applyLabel, chooseEffort, effortRequest, lutou, needsClassifier, planContext, rank, usageNumbers } from './policy.js';

// side classifier: a function of its own at the top, as the engine follows $ only into those
async function classify($, decision, text, metadata) {
  try {
    const r = await $.model.complete({
      model: CLASSIFIER.model,
      system: CLASSIFIER_SYSTEM,
      prompt: `<request>${String(text).slice(0, CLASSIFIER.maxChars)}</request>`,
      maxTokens: 5,
      effort: 'low',
      timeoutMs: CLASSIFIER.timeoutMs,
    });
    return { decision: r.isAnswered ? applyLabel(decision, r.text, metadata) : decision, used: usageNumbers(r.usage) };
  } catch (error) {
    // a refused request keeps the regex decision; the turn never waits on a failure
    $.ui.log(`Wave effort: classifier unavailable (${error?.message ?? error}); keeping the local rule.`);
    return { decision, used: null };
  }
}


// the pane core joins the events both use (the engine accepts one unmatched hook per event)
// the mode lives in the module so the pane buttons can change it without going through /wave-effort
let mode = 'auto';
let avisado = null;
export function definirModo(valor) {
  if (!MODES.includes(valor)) return false;
  mode = valor;
  return true;
}
export const modoAtual = () => mode;

export function register(on) {
  let permissionMode;
  let pending = [];
  const turns = new Map();
  let last = null;
  // safety net: main turns left in which automatic lowering is paused, and the main turn now running
  let pausa = 0;
  let turnoAtual = null;
  let requests = 0;
  let changed = 0;
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  // side classifier calls and their own tokens, kept apart from the main conversation's
  let haiku = 0;
  let haikuIn = 0;
  let haikuOut = 0;

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'wave-effort',
      description: 'Sets the conversation effort by how hard each request is, without switching models',
      argumentHint: '[auto|low|medium|high|xhigh|max|inherit|off|status]',
    });
    await inicio($, e);
    return next(e);
  });

  on('command.run', { command: 'wave-effort' }, async ($, e) => {
    const value = e.args.trim().toLowerCase();
    if (!value || value === 'status') {
      $.ui.log(`Wave effort | mode=${mode} | paused=${pausa} | requests=${requests} | adjusted=${changed} | input=${input} | output=${output} | cache read=${cacheRead} | cache write=${cacheWrite} | haiku=${haiku} (input=${haikuIn}, output=${haikuOut}). Observed counts, no savings estimate.`);
      return {};
    }
    if (!MODES.includes(value)) {
      $.ui.toast(`Invalid mode. Use: ${MODES.join(', ')} or status.`);
      return {};
    }
    mode = value;
    mostrarModo($, mode);
    $.ui.toast(`Wave effort: ${mode}. Applies to the next turns of this session.`);
    return {};
  });

  on('prompt.submit', async ($, e, next) => {
    const entry = {
      text: e.text,
      hasAttachments: Boolean(e.attachments?.length),
      // A prompt delivered into an already running turn may not create its
      // own turn.start. Never let it grant a later turn permission to downshift.
      // e.context is ignored: other mods (prismantis) add notes to every prompt.
      hasContext: Boolean(e.turnId),
      origin: e.origin?.kind,
    };
    pending.push(entry);
    if (pending.length > 64) pending.shift();
    try {
      const result = await next(e);
      if (result?.drop) pending = pending.filter(item => item !== entry);
      return result;
    } catch (error) {
      pending = pending.filter(item => item !== entry);
      throw error;
    }
  }).catch(async ($, e, next) => {
    pending = [];
    $.ui.toast('Wave effort: metadata unavailable; keeping the original flow.');
    return next(e);
  });

  on('turn.start', async ($, e, next) => {
    const index = pending.findIndex(item => item.text === e.text);
    const metadata = index < 0 ? null : pending.splice(index, 1)[0];
    let decision = chooseEffort(mode, e.text, metadata, last);
    if (!e.agentId && needsClassifier(decision)) {
      const side = await classify($, decision, e.text, metadata);
      decision = side.decision;
      if (side.used) {
        haiku += 1;
        haikuIn += side.used.input + side.used.cacheRead + side.used.cacheWrite;
        haikuOut += side.used.output;
        registrarHaiku($, side.used);
      }
    }
    // An approval never replaces the scored prompt it inherits from.
    if (!e.agentId && decision.level && decision.level !== 'continuation' && !decision.herdado) last = decision;
    const semDescer = !e.agentId && pausa > 0;
    if (!e.agentId) {
      if (pausa > 0) pausa -= 1;
      turnoAtual = e.turnId;
    }
    turns.set(e.turnId, { ...decision, semDescer, announced: false, passos: 0, erros: 0, baixou: false });
    // Bound memory if another extension suppresses turn.complete.
    if (turns.size > 64) turns.delete(turns.keys().next().value);
    if (!e.agentId) await turnoComeca($, e.turnId, e.text ?? '');
    return next(e);
  });

  on('turn.step', async function* ($, e, next) {
    // This mod changes only the main conversation, never subagents.
    if (e.agentId) return yield* next(e);
    const decision = turns.get(e.turnId);
    // nível escolhido à mão vale já na próxima requisição, mesmo no meio de um turno (a click means now)
    const manual = LEVELS.includes(mode) && typeof e.effort === 'string' && rank(e.effort) >= 0;
    const request = manual ? (e.effort === mode ? e : { ...e, effort: mode }) : effortRequest(e, decision);
    if (decision) {
      decision.passos += 1;
      if (rank(request.effort) < rank(e.effort)) decision.baixou = true;
    }
    // only an actual change is announced, with its direction; nothing asks the user to type a command
    // sem decisão do turno (clique no meio dele) também avisa, uma vez por mudança
    if (request !== e && !(decision?.announced) && (decision || request.effort !== avisado)) {
      if (decision) decision.announced = true;
      avisado = request.effort;
      $.ui.toast(`Wave effort: ${request.effort} ${rank(request.effort) > rank(e.effort) ? '↑' : '↓'} | ${decision?.reason ?? 'chosen in the pane'}`);
    }
    // Forward the original stream and final value exactly once. Never retry:
    // retrying after partial output can duplicate responses and tool actions.
    const result = yield* next(request);
    // The footer shows the session effort; this shows what this request used.
    mostrarEsforco($, request.effort ?? 'model default');
    requests += 1;
    if (request !== e) changed += 1;
    const counted = usageNumbers(result.usage);
    input += counted.input;
    output += counted.output;
    cacheRead += counted.cacheRead;
    cacheWrite += counted.cacheWrite;
    registrarUso($, { effort: request.effort ?? 'default', mudou: request !== e, ...counted });
    return result;
  });

  // The settings-hook event carries the permission mode, which no other
  // main-session event exposes; it also lets us hand the model a note.
  on('classic.UserPromptSubmit', async ($, e, next) => {
    permissionMode = e.permission_mode;
    const result = await next(e);
    if (e.agent_id || mode === 'off' || (e.source && e.source !== 'user')) return result;
    const notes = planContext({ text: e.prompt, permissionMode });
    if (!notes.length) return result;
    return { ...result, additionalContext: [...(result?.additionalContext ?? []), ...notes] };
  });

  // tool calls carry no turn id: errors of the main conversation count for the main turn now running
  on('tool.call', async ($, e, next) => {
    const result = await ferramenta($, e, next);
    if (!e.agentId && result?.isError) {
      const decision = turns.get(turnoAtual);
      if (decision) decision.erros += 1;
    }
    return result;
  });

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) await turnoTermina($, e.turnId);
    if (!e.agentId) {
      const decision = turns.get(e.turnId);
      if (decision && lutou(decision)) {
        pausa = REDE.turnos;
        $.ui.toast(`Wave effort: the lowered turn took ${decision.passos} steps and ${decision.erros} error(s); no lowering for the next ${REDE.turnos} turns.`);
      }
      turns.delete(e.turnId);
      if (turnoAtual === e.turnId) turnoAtual = null;
    }
    return next(e);
  });

  on('session.end', async ($, e, next) => {
    mode = 'auto';
    permissionMode = undefined;
    last = null;
    pausa = 0;
    turnoAtual = null;
    pending = [];
    turns.clear();
    mostrarEsforco($, undefined);
    requests = changed = input = output = cacheRead = cacheWrite = haiku = haikuIn = haikuOut = 0;
    await fim($);
    return next(e);
  });
}

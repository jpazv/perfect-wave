import { expect, test } from 'claude-code/testing';
import { chooseEffort, effortRequest, assessDifficulty, planContext, lutou, REDE, needsClassifier, applyLabel } from '../hooks/effort/policy.js';

const SIMPLE = 'Traduza para ingles: "Bom dia, como voce esta?"';
const META = { origin: 'composer', hasAttachments: false, hasContext: false };

function setup(on, haikuReply) {
  const state = { requests: [], notices: [], logs: [], commands: [], modelCalls: 0 };
  on('command.register', ($, e) => { state.commands.push(e.name); return { value: undefined }; });
  on('ui.toast', ($, e) => { state.notices.push(e.text); return { value: undefined }; });
  on('ui.log', ($, e) => { state.logs.push(e.text); return { value: undefined }; });
  on('ui.status', ($, e) => { state.status = e.text; return { value: undefined }; });
  on('session.start', () => ({ cwd: '/project' }));
  on('session.end', ($, e) => ({ sessionId: e.sessionId }));
  on('prompt.submit', ($, e) => ({ text: e.text }));
  on('turn.start', ($, e) => ({ turnId: e.turnId }));
  on('turn.complete', () => ({ text: '' }));
  on('classic.UserPromptSubmit', () => ({}));
  on('tool.call', () => ({ isError: true, result: 'falhou', text: 'falhou' }));
  on('turn.step', async function* ($, e) {
    state.requests.push({ ...e });
    yield { kind: 'text', index: 0, text: 'resposta' };
    return {
      turnId: e.turnId, index: e.index, answer: 'resposta', toolUses: [], stopReason: 'end_turn',
      usage: { input_tokens: 9, output_tokens: 3, cache_read_input_tokens: 11, cache_creation_input_tokens: 2 },
    };
  });
  on('model.complete', ($, e) => {
    state.modelCalls += 1;
    state.haikuAsks = [...(state.haikuAsks ?? []), e];
    if (haikuReply === undefined) return { deny: 'proibido no teste' };
    return { value: { isAnswered: true, text: haikuReply, usage: { input_tokens: 120, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } };
  });
  on('model.classify', () => { state.modelCalls += 1; return { deny: 'proibido no teste' }; });
  on('agent.spawn', () => { state.modelCalls += 1; return { deny: 'proibido no teste' }; });
  return state;
}

async function begin($, text, id = 'turn-1', extras = {}) {
  await $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false, ...extras });
  await $.turn.start({ text, turnId: id });
}

// the session effort is the user's /effort; medium is Opus 5.5's default
async function request($, id = 'turn-1', extras = {}) {
  const stream = $.turn.step({ turnId: id, index: 0, model: 'claude-opus-5-5', messageCount: 20, effort: 'medium', ...extras });
  const chunks = [];
  let entry = await stream.next();
  while (!entry.done) { chunks.push(entry.value); entry = await stream.next(); }
  return { chunks, result: entry.value };
}

test('registers one command and creates no agents or classifier requests', async ($, on) => {
  const state = setup(on);
  await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true });
  expect(state.commands).toContain('wave-effort');
  await $.command.run({ command: 'wave-effort', args: 'status' });
  expect(state.modelCalls).toBe(0);
  expect(state.requests.length).toBe(0);
});

test('never changes the model, in any mode or level (the cache is model-scoped)', async ($, on) => {
  const state = setup(on);
  for (const [text, id] of [[SIMPLE, 'a'], ['Refatore a arquitetura de auth e migre o banco de dados', 'b'], ['Adicione um teste para a funcao soma', 'c']]) {
    await begin($, text, id);
    await request($, id);
  }
  await $.command.run({ command: 'wave-effort', args: 'max' });
  await begin($, 'qualquer coisa', 'd');
  await request($, 'd', { model: 'claude-haiku-5-5' });
  expect(state.requests.map(e => e.model)).toEqual(['claude-opus-5-5', 'claude-opus-5-5', 'claude-opus-5-5', 'claude-haiku-5-5']);
});

test('a short literal transformation lowers effort and keeps the exact stream result', async ($, on) => {
  const state = setup(on);
  await begin($, SIMPLE);
  const answer = await request($);
  expect(state.requests[0].effort).toBe('low');
  expect(answer.chunks).toEqual([{ kind: 'text', index: 0, text: 'resposta' }]);
  expect(answer.result.answer).toBe('resposta');
  expect(state.modelCalls).toBe(0);
});

test('free-form prompts get a level and a target effort, capped at high', () => {
  const cases = [
    ['traduza pra ingles bom dia', 'simple', 'low'],
    ['Resuma esse paragrafo: o time entregou tudo', 'simple', 'low'],
    ['o que significa idempotente?', 'simple', 'low'],
    ['Adicione um teste para a funcao soma', 'routine', 'medium'],
    ['Corrija esse bug no componente de lista', 'routine', 'medium'],
    ['Corrija esse bug no componente de login', 'unsure', 'high'],
    ['Refatore a arquitetura de auth e migre o banco de dados em todos os servicos', 'heavy', 'high'],
    ['Bom dia', 'unsure', 'null'],
    ['comenta os cards 12, 34 e coloca em validation', 'simple', 'low'],
    ['move o card 56 para em andamento', 'simple', 'low'],
    ['pode commitar', 'simple', 'low'],
    ['commita e da push', 'simple', 'low'],
    ['pode apagar a tabela', 'unsure', 'high'],
    ['fecha a issue do deploy', 'unsure', 'high'],
  ];
  for (const [text, level, effort] of cases) {
    expect(assessDifficulty(text).level).toBe(level);
    expect(String(chooseEffort('auto', text, META).effort)).toBe(effort);
  }
});

test('automatic mode lowers for plain text, card chores and routine code; doubts and heavy tasks only raise', () => {
  const at = (effort) => ({ model: 'claude-opus-5-5', effort, turnId: 't', index: 0 });
  const routine = chooseEffort('auto', 'Adicione um teste para a funcao soma', META);
  const heavy = chooseEffort('auto', 'Planeje a migracao do banco de producao', META);
  const simple = chooseEffort('auto', SIMPLE, META);
  expect(effortRequest(at('low'), routine).effort).toBe('medium');   // raise
  expect(effortRequest(at('xhigh'), routine).effort).toBe('medium'); // routine lowers to medium
  expect(effortRequest(at('medium'), heavy).effort).toBe('high');   // raise
  expect(effortRequest(at('max'), heavy).effort).toBe('max');       // heavy never lowers
  expect(effortRequest(at('xhigh'), simple).effort).toBe('low');    // plain text may lower
});

test('an explicit level wins in both directions', () => {
  const at = (effort) => ({ model: 'claude-opus-5-5', effort, turnId: 't', index: 0 });
  expect(effortRequest(at('max'), chooseEffort('low', 'Refatore tudo', META)).effort).toBe('low');
  expect(effortRequest(at('low'), chooseEffort('max', SIMPLE, META)).effort).toBe('max');
});

test('a bare approval inherits the last scored effort and its lowering rule', () => {
  const prevSimple = chooseEffort('auto', SIMPLE, META);
  const prevRoutine = chooseEffort('auto', 'Adicione um teste para a funcao soma', META);
  const at = (effort) => ({ model: 'claude-opus-5-5', effort, turnId: 't', index: 0 });
  expect(effortRequest(at('high'), chooseEffort('auto', 'pode aplicar', META, prevSimple)).effort).toBe('low');
  expect(effortRequest(at('high'), chooseEffort('auto', 'pode aplicar', META, prevRoutine)).effort).toBe('medium');
  expect(chooseEffort('auto', 'pode aplicar', META, null).effort).toBe(null);
});

test('an approval after a simple prompt keeps the same effort and shows it in the status', async ($, on) => {
  const state = setup(on);
  await begin($, SIMPLE, 'first');
  await request($, 'first');
  await begin($, 'ok', 'second');
  await request($, 'second');
  expect(state.requests.map(e => e.effort)).toEqual(['low', 'low']);
  expect(state.status).toMatch(/^Wave effort: low/);
});

test('announces only a real change, with its direction, and never asks for a command', async ($, on) => {
  const state = setup(on);
  await begin($, 'Planeje a migracao do banco de producao', 'up');
  await request($, 'up', { effort: 'low' });
  await begin($, SIMPLE, 'down');
  await request($, 'down', { effort: 'high' });
  await begin($, 'Bom dia', 'still');
  await request($, 'still', { effort: 'medium' });
  expect(state.requests.map(e => e.effort)).toEqual(['high', 'low', 'medium']);
  expect(state.notices.some(n => n.startsWith('Wave effort: high ↑'))).toBe(true);
  expect(state.notices.some(n => n.startsWith('Wave effort: low ↓'))).toBe(true);
  expect(state.notices.length).toBe(2);
  expect(state.notices.some(n => n.includes('/wave-effort'))).toBe(false);
});

test('asks for a plan only on heavy tasks, never just because auto mode was turned on', () => {
  const heavy = 'Refatore a arquitetura de auth e migre o banco de dados em todos os servicos';
  expect(planContext({ text: heavy, permissionMode: 'default' })[0]).toContain('heavy task');
  expect(planContext({ text: heavy, permissionMode: 'auto' })[0]).toContain('heavy task');
  expect(planContext({ text: 'comenta os cards 12, 34 e coloca em validation', permissionMode: 'auto' })).toEqual([]);
  expect(planContext({ text: heavy, permissionMode: 'plan' })).toEqual([]);
});

test('the prompt hook adds no plan note when auto mode is turned on for a light task', async ($, on) => {
  setup(on);
  const base = { session_id: 's', transcript_path: '/t', cwd: '/project', prompt: 'oi', source: 'user' };
  await $.classic.UserPromptSubmit({ ...base, permission_mode: 'default' });
  const first = await $.classic.UserPromptSubmit({ ...base, permission_mode: 'auto' });
  expect(first?.additionalContext ?? []).toEqual([]);
});

test('a print keeps at least medium; notes from other mods do not block', async ($, on) => {
  const state = setup(on);
  await begin($, SIMPLE, 'attached', { attachments: [{ type: 'image', mediaType: 'image/png' }] });
  await request($, 'attached', { effort: 'high' });
  await begin($, SIMPLE, 'context', { context: ['regras de outro mod'] });
  await request($, 'context', { effort: 'high' });
  expect(state.requests.map(e => e.effort)).toEqual(['medium', 'low']);
});

test('a model without effort or a numeric effort is left untouched', () => {
  const simple = chooseEffort('auto', SIMPLE, META);
  const semEffort = { model: 'claude-haiku-4-5', turnId: 't', index: 0 };
  const numerico = { model: 'custom-model', effort: 7, turnId: 't', index: 0 };
  expect(effortRequest(semEffort, simple)).toBe(semEffort);
  expect(effortRequest(numerico, simple)).toBe(numerico);
});

test('a peer message and an unmatched continuation preserve the current effort', async ($, on) => {
  const state = setup(on);
  await begin($, SIMPLE, 'peer', { origin: { kind: 'peer' } });
  await request($, 'peer');
  await $.turn.start({ text: SIMPLE, turnId: 'unmatched' });
  await request($, 'unmatched');
  expect(state.requests.map(e => e.effort)).toEqual(['medium', 'medium']);
});

test('input typed during another turn cannot authorize an automatic lowering', async ($, on) => {
  const state = setup(on);
  await begin($, SIMPLE, 'queued', { turnId: 'already-running', wait: true });
  await request($, 'queued');
  expect(state.requests[0].effort).toBe('medium');
});

test('a hand-picked level takes effect from the next request, even mid-turn', async ($, on) => {
  const state = setup(on);
  await $.command.run({ command: 'wave-effort', args: 'high' });
  await begin($, 'Implemente um recurso');
  await request($);
  await $.command.run({ command: 'wave-effort', args: 'low' });
  await request($, 'turn-1', { index: 1 });
  expect(state.requests.map(e => e.effort)).toEqual(['high', 'low']);
});

test('never changes a subagent request, even in explicit mode', async ($, on) => {
  const state = setup(on);
  await $.command.run({ command: 'wave-effort', args: 'low' });
  await begin($, SIMPLE);
  await request($, 'turn-1', { agentId: 'unrelated-agent', effort: 'max' });
  expect(state.requests[0].effort).toBe('max');
});

test('off and inherit pass the event through without modifying any fields', () => {
  const event = { model: 'claude-opus-5-5', effort: 'max', turnId: 'x', index: 0 };
  for (const mode of ['off', 'inherit']) {
    expect(effortRequest(event, chooseEffort(mode, SIMPLE, META))).toBe(event);
  }
});

test('clear resets the mode and removes stale turn state', async ($, on) => {
  const state = setup(on);
  await $.command.run({ command: 'wave-effort', args: 'low' });
  await begin($, 'Tarefa complexa');
  await $.session.end({ reason: 'clear', sessionId: 'test', resume: {} });
  await request($);
  await $.command.run({ command: 'wave-effort', args: 'status' });
  expect(state.requests[0].effort).toBe('medium');
  expect(state.logs[0]).toContain('mode=auto');
});

test('usage is observed from existing responses without a new model request', async ($, on) => {
  const state = setup(on);
  await begin($, SIMPLE);
  await request($);
  await $.command.run({ command: 'wave-effort', args: 'status' });
  expect(state.logs[0]).toContain('input=9');
  expect(state.logs[0]).toContain('cache read=11');
  expect(state.modelCalls).toBe(0);
});

test('invalid commands do not silently switch the effort', async ($, on) => {
  const state = setup(on);
  await $.command.run({ command: 'wave-effort', args: 'low; rm -rf /' });
  await begin($, 'Bom dia');
  await request($);
  expect(state.requests[0].effort).toBe('medium');
  expect(state.notices[0]).toContain('Invalid');
});

test('interrupted turns release the decision', async ($, on) => {
  const state = setup(on);
  await begin($, SIMPLE);
  await $.turn.complete({ turnId: 'turn-1', answer: '', durationMs: 5, isAborted: true, usage: null });
  await request($);
  expect(state.requests[0].effort).toBe('medium');
});

const HEAVY = 'Refatore a arquitetura de auth e migre o banco de dados em todos os servicos';

test('approving the plan of a heavy task executes at medium, never below it', () => {
  const at = (effort) => ({ model: 'claude-opus-5-5', effort, turnId: 't', index: 0 });
  const plano = chooseEffort('auto', HEAVY, META);
  const execucao = chooseEffort('auto', 'pode aplicar', META, plano);
  expect(execucao.level).toBe('execution');
  expect(effortRequest(at('high'), execucao).effort).toBe('medium');   // lowers from high
  expect(effortRequest(at('xhigh'), execucao).effort).toBe('medium');  // and from xhigh
  expect(effortRequest(at('low'), execucao).effort).toBe('medium');    // raises a low setting
  expect(effortRequest(at('medium'), execucao)).toEqual(at('medium')); // nothing to do
  // an approval after a routine prompt follows it to medium
  const rotina = chooseEffort('auto', 'Adicione um teste para a funcao soma', META);
  expect(effortRequest(at('high'), chooseEffort('auto', 'pode aplicar', META, rotina)).effort).toBe('medium');
});

test('the plan turn runs at high and the approvals after it at medium', async ($, on) => {
  const state = setup(on);
  await begin($, HEAVY, 'plano');
  await request($, 'plano');
  await begin($, 'ok, pode aplicar', 'execution');
  await request($, 'execution', { effort: 'high' });
  await begin($, 'pode', 'segue');
  await request($, 'segue', { effort: 'high' });
  expect(state.requests.map(e => e.effort)).toEqual(['high', 'medium', 'medium']);
});

test('the safety net only fires for a lowered turn that struggled', () => {
  expect(lutou({ baixou: true, passos: REDE.passos + 1, erros: 0 })).toBe(true);
  expect(lutou({ baixou: true, passos: 3, erros: REDE.erros })).toBe(true);
  expect(lutou({ baixou: true, passos: REDE.passos, erros: 1 })).toBe(false);
  expect(lutou({ baixou: false, passos: 50, erros: 5 })).toBe(false);
});

async function longTurn($, id, text, steps, effort = 'high') {
  await begin($, text, id);
  for (let index = 0; index < steps; index += 1) await request($, id, { index, effort });
  await $.turn.complete({ turnId: id, answer: '', durationMs: 5, isAborted: false, usage: null });
}

test('a lowered turn with many steps pauses lowering for the next turns, then it resumes', async ($, on) => {
  const state = setup(on);
  await longTurn($, 'longo', SIMPLE, REDE.passos + 1);
  expect(state.notices.some(n => n.includes('no lowering'))).toBe(true);
  const ids = [];
  for (let i = 0; i <= REDE.turnos; i += 1) {
    const id = `depois-${i}`;
    ids.push(id);
    await begin($, SIMPLE, id);
    await request($, id, { effort: 'high' });
    await $.turn.complete({ turnId: id, answer: '', durationMs: 5, isAborted: false, usage: null });
  }
  const depois = state.requests.filter(e => ids.includes(e.turnId)).map(e => e.effort);
  expect(depois).toEqual([...Array(REDE.turnos).fill('high'), 'low']);
});

test('two tool errors in a lowered turn also pause lowering; errors of subagents do not count', async ($, on) => {
  const state = setup(on);
  await begin($, SIMPLE, 'erros');
  await request($, 'erros', { effort: 'high' });
  await $.tool.call({ tool: 'Bash', command: 'false', agentId: 'sub' });
  await $.tool.call({ tool: 'Bash', command: 'false', agentId: 'sub' });
  await $.tool.call({ tool: 'Bash', command: 'false' });
  await $.turn.complete({ turnId: 'erros', answer: '', durationMs: 5, isAborted: false, usage: null });
  expect(state.notices.some(n => n.includes('no lowering'))).toBe(false);
  await begin($, SIMPLE, 'erros2');
  await request($, 'erros2', { effort: 'high' });
  await $.tool.call({ tool: 'Bash', command: 'false' });
  await $.tool.call({ tool: 'Bash', command: 'false' });
  await $.turn.complete({ turnId: 'erros2', answer: '', durationMs: 5, isAborted: false, usage: null });
  expect(state.notices.some(n => n.includes('no lowering'))).toBe(true);
  await begin($, SIMPLE, 'pausado');
  await request($, 'pausado', { effort: 'high' });
  expect(state.requests.at(-1).effort).toBe('high');
});

test('a raised turn that struggles does not pause anything', async ($, on) => {
  const state = setup(on);
  await longTurn($, 'pesado', HEAVY, REDE.passos + 5, 'medium');
  expect(state.notices.some(n => n.includes('no lowering'))).toBe(false);
  await begin($, SIMPLE, 'simple');
  await request($, 'simple', { effort: 'high' });
  expect(state.requests.at(-1).effort).toBe('low');
});

test('only a doubt without risk asks the side classifier', () => {
  expect(needsClassifier(chooseEffort('auto', 'trduz oi pra mim em ingles', META, null))).toBe(true);
  expect(needsClassifier(chooseEffort('auto', 'muda a cor do botao de salvar pra azul', META, null))).toBe(true);
  expect(needsClassifier(chooseEffort('auto', SIMPLE, META, null))).toBe(false);
  expect(needsClassifier(chooseEffort('auto', 'faz o deploy em producao', META, null))).toBe(false);
  expect(needsClassifier(chooseEffort('high', 'trduz oi', META, null))).toBe(false);
  expect(needsClassifier(chooseEffort('auto', 'trduz oi pra mim', { ...META, origin: 'peer' }, null))).toBe(false);
});

test('the label maps to an effort; an unknown reply keeps the local decision', () => {
  const d = chooseEffort('auto', 'trduz oi pra mim em ingles', META, null);
  expect(applyLabel(d, 'simple', META).effort).toBe('low');
  expect(applyLabel(d, ' Routine.', META).effort).toBe('medium');
  expect(applyLabel(d, 'heavy', META).effort).toBe('high');
  expect(applyLabel(d, 'simple', { ...META, hasAttachments: true }).effort).toBe('medium');
  expect(applyLabel(d, 'no idea', META)).toBe(d);
});

test('a typo the regex misses is lowered by the classifier, through the session client, without changing the model', async ($, on) => {
  const state = setup(on, 'simple');
  await begin($, 'trduz oi pra mim em ingles');
  await request($);
  expect(state.modelCalls).toBe(1);
  expect(state.haikuAsks[0].model).toBe('haiku');
  expect(state.haikuAsks[0].prompt).toContain('<request>trduz oi pra mim em ingles</request>');
  expect(state.requests[0].effort).toBe('low');
  expect(state.requests[0].model).toBe('claude-opus-5-5');
  await $.command.run({ command: 'wave-effort', args: 'status' });
  expect(state.logs.at(-1)).toContain('haiku=1 (input=120, output=1)');
});

test('a small style change goes to medium through the classifier', async ($, on) => {
  const state = setup(on, 'routine');
  await begin($, 'muda a cor do botao de salvar pra azul');
  await request($, 'turn-1', { effort: 'high' });
  expect(state.requests[0].effort).toBe('medium');
});

test('a refused or failed classifier keeps the current effort', async ($, on) => {
  const state = setup(on);
  await begin($, 'trduz oi pra mim em ingles');
  await request($, 'turn-1', { effort: 'high' });
  expect(state.modelCalls).toBe(1);
  expect(state.requests[0].effort).toBe('high');
});

test('clear prompts and risky doubts never call the classifier', async ($, on) => {
  const state = setup(on, 'simple');
  await begin($, SIMPLE, 'a');
  await request($, 'a');
  await begin($, 'por que o login quebrou', 'b');
  await request($, 'b');
  expect(state.modelCalls).toBe(0);
});

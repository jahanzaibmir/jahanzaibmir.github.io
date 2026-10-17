// The terminal in About types out a short session once it scrolls into view.
// Commands are typed a letter at a time; their output appears line by line.

import { $, reduceMotion, afterIntro, escapeHtml } from './lib/env.js';

const SESSION = [
  ['cmd', 'whoami'],
  ['out', 'jahanzaib ashraf mir'],
  ['cmd', 'cat about.txt'],
  ['out', 'cybersecurity engineer and researcher'],
  ['out', 'b.tech in cybersecurity, srm university ap'],
  ['cmd', 'ls projects'],
  ['out', 'mirage   shieldx   misery   relis'],
  ['cmd', 'cat focus.txt'],
  ['out', 'low level programming'],
  ['out', 'computer networking'],
  ['out', 'offensive and defensive security'],
  ['cmd', 'echo $GOAL'],
  ['out', 'build systems that are hard to break, starting from the kernel']
];

const PROMPT = '<span class="ps">~ $</span> ';

export function initTerminal() {
  const out = $('#term');
  if (!out) return;

  const line = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
    return div;
  };

  if (reduceMotion || !('IntersectionObserver' in window)) {
    SESSION.forEach(([kind, text]) => line(kind === 'cmd' ? `${PROMPT}<span class="cmd">${escapeHtml(text)}</span>` : `<span class="out">${escapeHtml(text)}</span>`));
    line(PROMPT);
    return;
  }

  function type(text, done) {
    const div = line(`${PROMPT}<span class="cmd"></span><span class="cur"></span>`);
    const cmd = $('.cmd', div);
    let i = 0;
    const next = () => {
      cmd.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(next, 45 + Math.random() * 55);
      else {
        $('.cur', div).remove();
        setTimeout(done, 240);
      }
    };
    setTimeout(next, 380);
  }

  function run() {
    let i = 0;
    const step = () => {
      if (i >= SESSION.length) {
        line(`${PROMPT}<span class="cur"></span>`);
        return;
      }
      const [kind, text] = SESSION[i++];
      if (kind === 'cmd') {
        type(text, step);
      } else {
        line(`<span class="out">${escapeHtml(text)}</span>`);
        const more = i < SESSION.length && SESSION[i][0] === 'out';
        setTimeout(step, more ? 110 : 420);
      }
    };
    step();
  }

  afterIntro(() => {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      setTimeout(run, 600);
    }, { threshold: 0.35 });
    io.observe(out);
  });
}

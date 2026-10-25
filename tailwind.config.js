/** Design tokens live in src/styles/tokens.css (CSS variables); Tailwind just maps names to them. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ground: v('ground'), panel: v('panel'), raised: v('raised'),
        ink: v('ink'), mute: v('mute'), line: v('line'),
        brand: v('brand'), 'brand-ink': v('brand-ink'),
        ok: v('ok'), warn: v('warn'), bad: v('bad'), info: v('info'),
        bldA: v('bld-a'), bldB: v('bld-b'), bldC: v('bld-c'), bldD: v('bld-d'),
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'Impact', 'sans-serif'],
        sans: ['"Public Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { sign: '0.375rem', pill: '999px' },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '60%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgb(var(--ok) / .5)' }, '100%': { boxShadow: '0 0 0 14px rgb(var(--ok) / 0)' } },
      },
      animation: { pop: 'pop .45s cubic-bezier(.2,.9,.3,1.2) both', pulseRing: 'pulseRing 1.6s ease-out infinite' },
    },
  },
  plugins: [],
}

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    -webkit-tap-highlight-color: transparent;
  }
  body {
    @apply bg-brave-cream text-navy-950 font-body antialiased;
  }
  h1, h2, h3, h4 {
    @apply font-display tracking-wide;
  }
  ::-webkit-scrollbar {
    height: 6px;
    width: 6px;
  }
  ::-webkit-scrollbar-thumb {
    @apply bg-navy-600 rounded-full;
  }
}

@layer components {
  .stat-table {
    @apply w-full text-xs sm:text-sm border-collapse;
  }
  .stat-table th {
    @apply sticky top-0 bg-navy text-white/90 font-display font-medium tracking-wide text-[10px] sm:text-xs uppercase px-2 py-2 text-right whitespace-nowrap;
  }
  .stat-table th:first-child {
    @apply text-left sticky left-0 z-10;
  }
  .stat-table td {
    @apply px-2 py-1.5 text-right whitespace-nowrap border-b border-navy-950/5;
  }
  .stat-table td:first-child {
    @apply text-left font-medium sticky left-0 bg-white;
  }
  .stat-table tbody tr:nth-child(even) td {
    @apply bg-navy-950/[0.02];
  }
  .stat-table tbody tr:nth-child(even) td:first-child {
    @apply bg-brave-cream;
  }
  .pill-button {
    @apply inline-flex items-center gap-1.5 rounded-full border border-navy-950/10 bg-white px-3 py-1.5 text-xs font-medium text-navy-800 shadow-sm transition hover:border-navy-600 active:scale-95;
  }
  .pill-button[data-active='true'] {
    @apply bg-navy text-white border-navy;
  }
  .card {
    @apply rounded-card bg-white shadow-card border border-navy-950/5;
  }
}

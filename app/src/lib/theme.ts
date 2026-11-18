// Colours and sizes, matching the 3M CBTD Technical Document Library page.
export const colors = {
  red: '#FF0000',
  redDark: '#C00000',
  black: '#0B0B0C',
  ink: '#1A1A1B',
  paper: '#FFFFFF',
  grey: '#F4F4F5',
  line: '#E2E2E4',
  muted: '#5C5C61',
  heroText: '#FFE3E3',
  sideLine: '#2A2A2E',
  sideHover: '#1C1C20',
  sideText: '#E8E8EA',
  sideMuted: '#A9A9B0',
  pill: '#2A2A2E',
  pillText: '#C9C9CF',
};

/** Below this width the sidebar becomes a drawer opened from the top bar. */
export const WIDE = 880;
export const SIDEBAR_WIDTH = 300;

/** Pressable state. `hovered` is set on the web only; React Native's types omit it. */
export type Hover = { pressed: boolean; hovered?: boolean };

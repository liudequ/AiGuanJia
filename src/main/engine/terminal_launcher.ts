export interface LaunchCommand {
  program: string;
  args: string[];
}

export type TerminalType = 'wezterm' | 'iterm2' | 'gnome-terminal';

export function buildTerminalCommand(
  terminalType: string,
  projectPath: string,
  command: string,
  args: string[]
): LaunchCommand {
  if (terminalType === 'wezterm') {
    return {
      program: 'wezterm',
      args: ['start', '--cwd', projectPath, '--', command, ...args]
    };
  }

  if (terminalType === 'iterm2') {
    const shellCommand = ['cd', projectPath, '&&', command, ...args].join(' ');
    return {
      program: 'open',
      args: ['-a', 'iTerm', '--args', 'sh', '-lc', shellCommand]
    };
  }

  if (terminalType === 'gnome-terminal') {
    return {
      program: 'gnome-terminal',
      args: [`--working-directory=${projectPath}`, '--', command, ...args]
    };
  }

  throw new Error(`Unsupported terminal type: ${terminalType}`);
}

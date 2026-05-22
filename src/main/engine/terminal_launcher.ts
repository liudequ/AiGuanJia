export interface LaunchCommand {
  program: string;
  args: string[];
}

export type TerminalType = 'wezterm' | 'iterm2' | 'gnome-terminal';

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function buildTerminalCommand(
  terminalType: TerminalType,
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
    const escapedCommand = [command, ...args].map(shellEscape).join(' ');
    const shellCommand = `cd ${shellEscape(projectPath)} && ${escapedCommand}`;

    return {
      program: 'open',
      args: ['-a', 'iTerm', '--args', 'sh', '-lc', shellCommand]
    };
  }

  return {
    program: 'gnome-terminal',
    args: [`--working-directory=${projectPath}`, '--', command, ...args]
  };
}

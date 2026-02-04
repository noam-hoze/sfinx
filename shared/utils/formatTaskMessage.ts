// TODO: This is a hardcoded solution for demo purposes
// Need to refactor to handle multiple message types and be more generic

/**
 * Formats the initial coding task message with markdown structure for better visual clarity.
 * Currently only used for the first task message in the coding interview.
 *
 * @param taskText - The raw task description text
 * @returns Formatted markdown string with title, sections, and visual hierarchy
 */
export function formatInitialTaskMessage(taskText: string): string {
  // Extract the closing message
  const closingMatch = taskText.match(/(Feel free to ask.*)/i);
  const mainText = closingMatch
    ? taskText.replace(closingMatch[0], '').trim()
    : taskText;

  // Check if this is a complex technical challenge (Deep Learning type)
  const isComplexChallenge = mainText.toLowerCase().includes('do not use') &&
                             mainText.toLowerCase().includes('implement');

  if (isComplexChallenge) {
    return formatComplexChallenge(mainText);
  }

  // For simpler challenges, use basic format
  return formatSimpleChallenge(mainText);
}

/**
 * Format complex challenges with multiple sections (for Deep Learning task)
 */
function formatComplexChallenge(taskText: string): string {
  const sections: string[] = [];

  sections.push('## 🎯 Coding Challenge\n\n');

  // * * * Your Task Section * * *
  sections.push('### 🧠 Your Task\n\n');

  // Extract and format main description
  const browserMatch = taskText.match(/This challenge runs ([^.]+)\./i);
  if (browserMatch) {
    const desc = 'This challenge runs ' + browserMatch[1] + '.';
    sections.push(desc.replace(/entirely in the browser/i, '**entirely in the browser**')
                     .replace(/Python with NumPy only/g, '**Python with NumPy only**'));
    sections.push('\n\n');
  }

  // Extract "do not use" list
  const doNotUseMatch = taskText.match(/do not use ([^.]+)/i);
  if (doNotUseMatch) {
    sections.push('**Do NOT use:**\n\n');
    const items = doNotUseMatch[1].split(/,?\s+or\s+|,\s+/);
    items.forEach(item => {
      const cleaned = item.trim().replace(/^(any\s+)?external libraries$/i, 'Any external libraries');
      if (cleaned) sections.push(`* ${cleaned}\n`);
    });
    sections.push('\n'); // Extra newline to exit list context
  }

  sections.push('\n'); // Line break between sections

  // What You Need to Do Section
  sections.push('### 🛠 What You Need to Do\n\n');

  const functionsMatch = taskText.match(/implement[^—]+—`([^`]+)`, `([^`]+)`, and `([^`]+)`—/i);
  if (functionsMatch) {
    sections.push('Implement the **three functions marked with `TODO`**:\n\n');
    sections.push(`1. \`${functionsMatch[1]}\`\n`);
    sections.push(`2. \`${functionsMatch[2]}\`\n`);
    sections.push(`3. \`${functionsMatch[3]}\`\n`);
  }

  sections.push('\n⚠️ **Important constraints:**\n\n');
  sections.push('* Do **not** change any constants\n');
  sections.push('* Do **not** modify helper code\n');
  sections.push('* Do **not** touch the grading section\n');
  sections.push('\n'); // Extra newline to exit list context

  sections.push('\n'); // Line break between sections

  // Goal Section
  sections.push('### 🎯 Goal\n\n');
  const goalMatch = taskText.match(/goal is to ([^.]+)/i);
  if (goalMatch) {
    let goal = goalMatch[1];
    goal = goal.replace(/log-Mel spectrogram/gi, '**log-Mel spectrogram**');
    goal = goal.replace(/fixed (\d+-second signal)/g, '**fixed $1**');
    goal = goal.replace(/2D spectral representation/g, '**2D spectral representation**');
    goal = goal.replace(/deep learning model/g, '**deep learning model**');
    sections.push(`Compute a ${goal}.\n`);
  }

  sections.push('\n'); // Line break between sections

  // Success Criteria Section
  sections.push('### ✅ Success Criteria\n\n');
  sections.push('Your solution must:\n\n');
  sections.push('* Run without errors\n');

  if (taskText.includes('shape, mean, standard deviation')) {
    sections.push('* Produce output whose **shape, mean, standard deviation, and SHA-256 hash** **exactly match** the expected output\n');
  } else {
    sections.push('* Produce output that **exactly matches** the expected output\n');
  }

  sections.push('\n'); // Extra newline to exit list context
  sections.push('Only then will it be considered correct.\n\n');

  sections.push('\n'); // Line break between sections

  // Questions Section
  sections.push('### 💬 Questions?\n\n');
  sections.push('Feel free to ask me anything you want.\n');

  return sections.join('');
}

/**
 * Format simpler challenges (React, Quantum Validator, etc.)
 */
function formatSimpleChallenge(taskText: string): string {
  const sections: string[] = [];

  sections.push('## 🎯 Coding Challenge\n\n');
  sections.push('### 🧠 Your Task\n\n');

  // Add emphasis to code elements
  let formatted = taskText;
  formatted = formatted.replace(/`([^`]+)`/g, '`$1`');
  formatted = formatted.replace(/React component/g, '**React component**');
  formatted = formatted.replace(/Python class/g, '**Python class**');

  sections.push(formatted + '\n\n');
  sections.push('### 💬 Questions?\n\n');
  sections.push('Feel free to ask me anything you want.\n');

  return sections.join('');
}

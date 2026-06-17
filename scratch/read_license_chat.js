const fs = require('fs');
const readline = require('readline');

async function main() {
  const fileStream = fs.createReadStream("C:\\Users\\Divyam Chandak\\.gemini\\antigravity-ide\\brain\\bfe267b5-8e28-4158-943f-621115e439ea\\.system_generated\\logs\\transcript.jsonl");
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const step = JSON.parse(line);
    const content = step.content || '';
    if (content.toLowerCase().includes('license') || content.toLowerCase().includes('saas') || content.toLowerCase().includes('copyright')) {
      console.log(`Step ${step.step_index} (${step.source} - ${step.type}):`);
      console.log(content.substring(0, 500));
      console.log('====================================');
    }
  }
}

main();

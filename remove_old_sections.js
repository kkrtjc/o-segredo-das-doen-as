const fs = require('fs');
const filePath = 'C:\\Users\\JOAO PAULO\\Documents\\GitHub\\o-segredo-das-doen-as\\index.html';
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// 0-indexed. Lines 864 to 1765 corresponds to index 863 to 1764
lines.splice(863, 1765 - 864 + 1);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Old sections removed successfully.');

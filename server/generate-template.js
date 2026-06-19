// server/generate-template.js
const XLSX = require('xlsx');
const path = require('path');

const data = [
  { 'Name': 'Arjun Kumar', 'Roll No': '22CS001', 'Gender': 'Boy', 'Class Name': 'CSE-A 1st Year' },
  { 'Name': 'Priya Sharma', 'Roll No': '22CS002', 'Gender': 'Girl', 'Class Name': 'CSE-A 1st Year' },
  { 'Name': 'Mohammed Ali', 'Roll No': '22EC001', 'Gender': 'Boy', 'Class Name': 'ECE-B 2nd Year' }
];

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(data);

const wscols = [
  { wch: 20 }, // Name
  { wch: 12 }, // Roll No
  { wch: 10 }, // Gender
  { wch: 20 }  // Class Name
];
worksheet['!cols'] = wscols;

XLSX.utils.book_append_sheet(workbook, worksheet, 'Students Template');

const destPath = path.join(__dirname, '..', 'public', 'template.xlsx');
XLSX.writeFile(workbook, destPath);

console.log('✅ Template Excel file generated successfully at:', destPath);

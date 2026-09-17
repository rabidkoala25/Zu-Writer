"use strict";
// Saves a generated file with a normal browser download.
async function saveFile(filename, blob, label) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  document.getElementById("status").textContent = `${label} downloaded.`;
}

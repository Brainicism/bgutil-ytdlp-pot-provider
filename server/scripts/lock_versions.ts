const fs = require('fs');
const pkg = require('./package.json');
const lock = require('./package-lock.json');

// Helper to get version from lockfile (handles v1, v2, and v3 formats)
const getLockedVersion = (name) => {
  const entry = lock.packages?.[`node_modules/${name}`] || lock.dependencies?.[name];
  return entry?.version;
};

// Update production dependencies
if (pkg.dependencies) {
  for (const name in pkg.dependencies) {
    const locked = getLockedVersion(name);
    if (locked) pkg.dependencies[name] = locked;
  }
}

// Update devDependencies
if (pkg.devDependencies) {
  for (const name in pkg.devDependencies) {
    const locked = getLockedVersion(name);
    if (locked) pkg.devDependencies[name] = locked;
  }
}

fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
console.log('package.json pinned to lockfile versions.');

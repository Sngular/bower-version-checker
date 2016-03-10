# bower-version-checker

### Step 1:

```
npm install -g https://github.com/jpruden92/bower-version-checker.git
```

### Step 2:

```
bvc
```

or

```
bower-version-checker
```

### Result Example:

```
Doing bower install...
Obtaining bower data...
Creating updates table...
Dependencies that you can update :-)
┌────────────────────────────────────────┬────────────────────┬────────────────────┐
│ Dependency name                        │ New version        │ Local version      │
├────────────────────────────────────────┼────────────────────┼────────────────────┤
│ example1                               │ ~1.3.1             │ ~1.0.0             │
├────────────────────────────────────────┼────────────────────┼────────────────────┤
│ example2                               │ ~1.0.1             │ ~0.1.1             │
├────────────────────────────────────────┼────────────────────┼────────────────────┤
│ example3                               │ ~0.2.3             │ ~0.1.1             │
└────────────────────────────────────────┴────────────────────┴────────────────────┘
```
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
┌────────────────────────────────────────┬────────────────────┬────────────────────┐
│ Dependency name                        │ New version        │ Local version      │
├────────────────────────────────────────┼────────────────────┼────────────────────┤
│ example1                               │ ~1.3.1             │ ~1.0.0             │
├────────────────────────────────────────┼────────────────────┼────────────────────┤
│ example2                               │ ~1.0.1             │ ~0.1.1             │
├────────────────────────────────────────┼────────────────────┼────────────────────┤
| paper-tabs                             │ UPDATED            │ ~1.3.7             |
├────────────────────────────────────────┼────────────────────┼────────────────────┤
│ example3                               │ ~0.2.3             │ ~0.1.1             │
└────────────────────────────────────────┴────────────────────┴────────────────────┘

? Do you want to update dependency example1 in bower.json with 1.3.1 version? (y/N) y
? Do you want to update dependency example2 in bower.json with 1.0.1 version? (y/N) n
? Do you want to update dependency example3 in bower.json with 0.2.3 version? (y/N) y

NEW BOWER:
{
  "name": "my-component",
  "version": "0.2.4",
  "dependencies": {
    "example1": "https://mirepo/miruta/example1.git#~1.3.1",
    "example2": "https://mirepo/miruta/example2.git#~0.1.1",
    "example2": "https://mirepo/miruta/example3.git#~0.2.3",
    "polymer": "Polymer/polymer#~1.3.1"
  },
  "devDependencies": {
    "paper-tabs": "PolymerElements/paper-tabs#~1.3.7",
    "web-component-tester": "^3.0.0",
    "iron-component-page": "PolymerElements/iron-component-page#~1.1.5",
  },
  "main": "my-component.html",
  "resolutions": {
    "polymer": "^1.1.0",
    "i18n-msg": "v1.0.4"
  }
}

? Do you want to save a new 'bower.json'? (y/N) y
currentDir /path/of/my/component
? Do you want to save actual bower.json like '_bower.json.old' ? (y/N) y

```

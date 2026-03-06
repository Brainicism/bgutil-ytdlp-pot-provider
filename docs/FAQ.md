# Frequently Asked Questions

### Which clients are supported?

This provider only provides PO tokens for WEB clients.
For example: `web`, `mweb`, `web_remix`.

The list from `yt-dlp` `2025.05.22` was:

```py
WEBPO_CLIENTS = (
    'WEB',
    'MWEB',
    'TVHTML5',
    'WEB_EMBEDDED_PLAYER',
    'WEB_CREATOR',
    'WEB_REMIX',
    'TVHTML5_SIMPLY',
    'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
)
```

See the most recent [full list](//github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/pot/utils.py) of WEB clients from `yt-dlp`.

--------

[↑ Back to Top](#frequently-asked-questions)

### I'm getting errors during `npm ci` or `npm install` on Termux

For provider versions >=1.2.0, you may have issues while installing the `canvas` dependency on Termux. The Termux environment is missing a `android_ndk_path` and two packages by default. Run the following commands to setup the dependencies correctly.

1. Install the packages.
```shell
pkg install libvips xorgproto
```

2. Create the shell function to adjust `~/.gyp/include.gypi` for us.
<details open>
  <summary>code for the shell function</summary>

```shell
update_gyp_config() (
  set -eu
  mkdir -p ~/.gyp
  cd ~/.gyp
  tmp_dir="$(mktemp -d ./tmp.XXXXXX)"
  if [ -s include.gypi ]; then
    cp -p include.gypi "${tmp_dir}/old"
    cp -p "${tmp_dir}/old" "${tmp_dir}/new"
    if ! grep -q 'android_ndk_path' "${tmp_dir}/new"; then
      if grep -q "'variables':[[:space:]]*{" "${tmp_dir}/new"; then
        sed "s/'variables':[[:space:]]*{/'variables':{'android_ndk_path':'',/" "${tmp_dir}/old" > "${tmp_dir}/new"
      else
        sed "1s/{/{'variables':{'android_ndk_path':''},/" "${tmp_dir}/old" > "${tmp_dir}/new"
      fi
    fi
  else
    printf > "${tmp_dir}/old" -- ''
    printf > "${tmp_dir}/new" -- "{'variables':{'android_ndk_path':''}}\n"
  fi
  if cmp -s "${tmp_dir}/old" "${tmp_dir}/new"; then
    printf 'No changes to apply.\n'
    rm -rf "${tmp_dir}"
  else
    printf 'Status of changes for ~/.gyp/include.gypi:\n'
    diff -su "${tmp_dir}/old" "${tmp_dir}/new" || true
    if mv -v -i "${tmp_dir}/new" include.gypi; then
      rm -rf "${tmp_dir}"
    else
      printf 'Changes not applied. Workspace preserved at: ~/.gyp/%s\n' "${tmp_dir#./}"
    fi
  fi
  if ! [ -d "${tmp_dir}" ]; then
    printf 'Cleanup complete.\n'
  fi
)

```

</details>

3. Call the newly created `update_gyp_config` function to actually adjust the `~/.gyp/include.gypi` file.
```shell
update_gyp_config
```

--------

Alternatively, you can handle the modification with Python instead of using `sed` to perform text manipulation.

1. Open the Python REPL:
```shell
python3
```

2. Define the Python function to adjust the file.
<details>
  <summary>code for the python function</summary>

```py
import ast, shutil, tempfile, subprocess
from pathlib import Path

def update_gyp_config():
  try:
    g_dir = Path.home() / '.gyp'
    g_dir.mkdir(parents=True, exist_ok=True)
    target = g_dir / 'include.gypi'

    with tempfile.TemporaryDirectory(dir=g_dir, prefix='tmp.') as t:
      t_p = Path(t)
      old, new = t_p / 'old', t_p / 'new'
      
      if target.exists() and 0 < target.stat().st_size:
        shutil.copy2(target, old)
        data = ast.literal_eval(old.read_text())
        if 'android_ndk_path' in data.get('variables', {}):
          print('No changes to apply.'); return
        
        data.setdefault('variables', {})['android_ndk_path'] = ''
        new.write_text(repr(data))
      else:
        old.touch()
        new.write_text("{'variables':{'android_ndk_path':''}}")

      print('Status of changes:')
      subprocess.run(['diff', '-su', old, new])
      if 0 == subprocess.run(['mv', '-v', '-i', new, target]).returncode:
        print('Changes applied.')
  except Exception as e:
    print(f'Error: {e}')

# Press Enter again if the prompt is still indented

```

</details>

3. When you are ready, and there were no errors, call that function with:
```py
update_gyp_config()
```

4. Close the Python REPL and return to your shell with:
```py
exit()
```

--------

[↑ Back to Top](#frequently-asked-questions)

### The `npm` package `canvas` is not installed?

When the `canvas` npm package was installed, it included `canvas.node` which itself also needs shared libraries.

Often, the operating system will have all of the shared libraries that are needed.

However, sometimes these can be is missing. When that happens you may see this message in the HTTP server logs:

`Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package`

You can find the path to that file with:
```sh
find node_modules -name canvas.node -print
```

Set a variable with the path to the file:
```sh
canvas_node_path='node_modules/canvas/build/Release/canvas.node'
```

After you have the path you can use:
```sh
ldd "${canvas_node_path}" | grep -F -e '=> not found'
```

The `ldd` command should show you where the system found the shared libraries required by `canvas.node`; and `grep` will only report any that were not found.

When you know what is missing, you can add the shared library to your operating system or place it into the same directory where `canvas.node` was found.

--------

[↑ Back to Top](#frequently-asked-questions)

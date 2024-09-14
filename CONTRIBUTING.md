### Coding conventions
Since the provider comes in two parts(the **Provider**(coded in typescript) and the **Provider plugin**(coded in python)), we have different code formatting standards for them.  
Please format your code by running this script below before you push a commit to your pull request:
```shell
# Make sure you have ruff, autopep8 and prettier installed already
ruff check --fix plugin/
autopep8 --in-place plugin/

cd server
npx prettier --check --write 'src/**/*.{js,ts}'
cd ..
```

#### **Provider**(typescript):
<!--Please complete this, @Brainicism-->

#### **Provider plugin**(python):
We follow the [yt-dlp coding conventions](https://github.com/yt-dlp/yt-dlp/blob/master/CONTRIBUTING.md#yt-dlp-coding-conventions).

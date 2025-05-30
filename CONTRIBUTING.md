# Contributing

Wappalyzer is an [GPLv3 licensed](https://github.com/HTTPArchive/wappalyzer/blob/main/LICENSE), open source project written in JavaScript. Anyone is welcome to contribute.

## Getting started

To get started, see the [README](https://github.com/HTTPArchive/wappalyzer/blob/main/README.md).

## Submitting changes

- First, run `npm run validate` to identify any issues.
- Use descriptive commit messages, e.g. 'Add WordPress detection'.
- Push your commits to a new branch on your own fork.
- Finally, submit a [pull request](https://help.github.com/articles/about-pull-requests/) and describe your changes.

## Adding a new technology

Wappalyzer uses [regular expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) to fingerprint technologies. Refer to the [specification](https://github.com/HTTPArchive/wappalyzer/blob/main/README.md#specification) for detail.

- Add a new block to [`src/technologies/*.json`](https://github.com/HTTPArchive/wappalyzer/blob/main/src/technologies). The filename should match the first letter of the technology name (a-z). Use `_.json` if the first character is a number or symbol.
- Add an icon to [`src/images/icons`](https://github.com/HTTPArchive/wappalyzer/tree/master/src/images/icons). The image must be square, either SVG or PNG (32 x 32 pixels).

Only widely used technologies are accepted. When creating a pull request, include ten or more links to websites that use the application, a GitHub page with at least 1,000 stars or anything that will help establish the size of the user base.

## Adding a new category

Please [open an issue on GitHub](https://github.com/HTTPArchive/wappalyzer/issues) first to discuss the need for a new category.

To add a category, edit [`src/categories.json`](https://github.com/HTTPArchive/wappalyzer/blob/main/src/categories.json) and update every [locale](https://github.com/HTTPArchive/wappalyzer/tree/master/src/_locales). You may use the English category name in all of them.

## Adding a new feature

Please [open an issue on GitHub](https://github.com/HTTPArchive/wappalyzer/issues) first. New features and large changes are rarely accepted without prior discussion.

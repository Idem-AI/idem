# Contributing to Idem

First off, thank you for considering contributing to Idem! It's people like you that make Idem such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by the [Idem Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for Idem.

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps to reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include screenshots if possible

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Idem, including completely new features and minor improvements to existing functionality.

* Use a clear and descriptive title
* Provide a step-by-step description of the suggested enhancement
* Provide specific examples to demonstrate the steps
* Describe the current behavior and explain which behavior you expected to see instead
* Explain why this enhancement would be useful to most Idem users

### Your First Code Contribution

Unsure where to begin contributing to Idem? You can start by looking through these `beginner` and `help-wanted` issues:

* Beginner issues - issues which should only require a few lines of code, and a test or two.
* Help wanted issues - issues which should be a bit more involved than beginner issues.

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the Angular 20 style guide
* Include screenshots in your pull request whenever possible
* End all files with a newline
* Avoid platform-dependent code

## Development Process

### Setting Up Development Environment

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/idem.git`
3. Install dependencies: `npm install`
4. Create a branch for your feature: `git checkout -b feature/amazing-feature`

### Style Guides

#### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

#### Angular Style Guide

This project follows the [official Angular style guide](https://angular.dev/style-guide) with particular attention to:

1. File Naming: hyphenated, consistent for component parts (e.g., my-component.ts, my-component.html)
2. Dependency Injection: Prefer inject() over constructor injection
3. Components/Directives: 
   - `protected` for template-only members
   - `readonly` for Angular-initialized properties (inputs, outputs, queries)
   - Group Angular-specific properties at the top
   - Prefer `[class.foo]` and `[style.bar]` over ngClass/ngStyle
   - Event handlers named by action (e.g., `saveUser()`)
4. Lifecycle Hooks: Implement interfaces, keep methods simple

#### JavaScript/TypeScript

* All TypeScript code is linted with TSLint
* Prefer the object spread operator (`{...anotherObj}`) to `Object.assign()`
* Inline `export`s with expressions whenever possible
* Format your code with Prettier

## Additional Notes

### Issue and Pull Request Labels

This section lists the labels we use to help us track and manage issues and pull requests.

* `bug` - Issues that are bugs
* `documentation` - Issues and PRs related to documentation
* `enhancement` - Issues that are feature requests and PRs that implement features
* `good first issue` - Good for newcomers
* `help wanted` - Extra attention is needed
* `invalid` - Issues that are invalid or non-reproducible
* `question` - Issues that are questions

Thanks again for your interest in contributing to Idem!

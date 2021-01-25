# How to contribute

One of the easiest ways to contribute is to participate in discussions and report issues. You can also contribute by submitting pull requests with code changes.

## Report Issues

We use [Github issues](https://github.com/lib-tools/lib-tools/issues) to track public bugs. Please ensure your description is clear and has sufficient instructions to be able to reproduce the issue.

## General Discussions

We use [GitHub Discussions Channel](https://github.com/lib-tools/lib-tools/discussions) for general lib-tools discussion.

## Contributing code and content

This is a rough outline of what a contributor's workflow looks like:

1. Search [GitHub](https://github.com/lib-tools/lib-tools/pulls) for an open or closed PR that relates to your submission. You don't want to duplicate effort.

2. Fork the [repo](https://github.com/lib-tools/lib-tools) and create your branch `topic` from master.

3. Make your changes in a new git branch.

4. Make sure your code lints by running `npm run lint` command if present.

5. Run the build with `npm run build` and test with `npm run build:samples` command if present, and ensure that all builds succeed.

6. Commit your changes using a descriptive commit message that follows our [commit message conventions](https://gist.github.com/mmzliveid/5d1ca6579da5ee60f5f4dee8d6201045).

7. Push your branch to GitHub forked repo.

8. In GitHub, submit a pull request to [lib-tools/lib-tools](https://github.com/lib-tools/lib-tools).

9. If you haven’t signed the CLA, you will see a automatic comment in the pull request. Click on the Details link. You will see the CLA. Click on sign in with Github to agree. And authorize CLA assistant to use your Github account to sign the CLA.

That's it! Thank you for your contribution. After your pull request is merged, you can safely delete your branch 'topic'.

## License

By contributing to, you agree that your contributions will be licensed under the LICENSE file in the root directory of this source tree.

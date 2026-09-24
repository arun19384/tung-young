# Project rules

## Ship every completed change

The user has authorized committing, pushing, and deploying completed changes to this project without asking for confirmation again.

- After each completed change, run the checks appropriate to the changed files and fix any failures before shipping. Documentation-only changes need a diff check, not a full application build.
- Commit the relevant changes and push to `main` in `https://github.com/arun19384/tung-young.git`. Preserve unrelated user changes and remote commits.
- Every shipped change must trigger a fresh Vercel production deployment. Use the Git integration when it starts a deployment for the pushed commit. If no new deployment starts, explicitly force a production deployment/redeployment of that commit using the linked project's supported Vercel tools (for example `vercel --prod --force` when the CLI and project link are available).
- Verify the pushed remote commit and, when Vercel access is available, the deployment status. Report the commit and deployment result honestly; do not claim that pushing alone proves a deployment succeeded.
- If credentials, project access, or deployment tools are unavailable, finish all possible checks and the push, then clearly report the deployment blocker. Do not create a new Vercel project or deploy to a guessed project.
- “Force deploy” means creating a fresh deployment, not rewriting Git history. Do not use `git push --force` or `--force-with-lease` without an explicit request to rewrite history.
- Apply this workflow once per completed task/change set, not after each intermediate file save.

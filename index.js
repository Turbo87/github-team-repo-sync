const inquirer = require('inquirer');
const octokit = require('@octokit/rest')();
const pMap = require('p-map');

run();

async function run() {
  let { org } = await inquirer.prompt([{
    name: 'org',
    message: 'GitHub organization:',
  }]);

  let { team_slug, token } = await inquirer.prompt([{
    name: 'team_slug',
    message: `${org} team name:`,
  }, {
    type: 'password',
    name: 'token',
    message: 'GitHub OAuth token:',
  }]);

  octokit.authenticate({ type: 'oauth', token });

  console.log(`Downloading list of teams for ${org} organization...`);
  let teams = await octokit.paginate(octokit.teams.list.endpoint.merge({ org }));
  let team = teams.find(team => team.slug === team_slug);
  if (!team) {
    console.log(`Team ${team_slug} not found in ${org} organization!`);
    return;
  }
  let team_id = team.id;

  console.log(`Downloading list of repositories for ${org} organization...`);
  let org_repos = await octokit.paginate(octokit.repos.listForOrg.endpoint.merge({ org }));
  let org_repo_names = org_repos.map(it => it.name);

  console.log(`Downloading list of repositories for ${team_slug} team...`);
  let team_repos = await octokit.paginate(octokit.teams.listRepos.endpoint.merge({ team_id }));
  let team_repo_names = team_repos.map(it => it.name);

  let missing_repo_names = org_repo_names.filter(it => !team_repo_names.includes(it));
  console.log(`Found ${missing_repo_names.length} missing repositories`);

  await pMap(missing_repo_names, async repo => {
    console.log(`Adding ${repo} repository to ${team_slug} team...`);
    await octokit.teams.addOrUpdateRepo({ team_id, owner: org, repo, permission: 'admin' });
  }, { concurrency: 4 });
}

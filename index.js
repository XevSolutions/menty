#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import prompts from "prompts";
import dotenv from "dotenv";
import os from "os";
import path from "path";
import fs from "fs";
import { exec, execSync } from "child_process";
import { deleteAsync } from "del";

dotenv.config();
const configPath = path.join(os.homedir(), ".your-cli-config.json");
const program = new Command();
program.version("0.1.0").option("--yarn", "Use Yarn instead of NPM");
program.parse(process.argv);
const options = program.opts();

if (options.logout) {
  try {
    fs.unlinkSync(configPath);
    console.log(chalk.green("Logged out successfully, API key cleared."));
  } catch (err) {
    console.error(chalk.red("Error during logout. Maybe you were not logged in."));
  }
}

async function main() {
  //^ Prompt for directory name
  const { directory } = await prompts({
    type: "text",
    name: "directory",
    message: "What is the name of the directory? (use . or ./ for current)",
    initial: ".",
  });

  //^ Check if directory exists and is not empty
  if (fs.existsSync(directory) && fs.readdirSync(directory).length > 0) {
    const { clearDir } = await prompts({
      type: "toggle",
      name: "clearDir",
      message: "Directory is not empty. Do you want to clear it?",
      initial: false,
      active: "Yes",
      inactive: "No",
    });

    if (clearDir) {
      const spinner = ora("Clearing directory...").start();
      await deleteAsync([`${directory}/**/*`, `${directory}/.*`, `!${directory}`], {
        force: true,
      });
      spinner.succeed("Directory cleared.");
      // This will delete all files inside the directory but keep the directory itself.
    } else {
      console.log(chalk.yellow("Operation cancelled."));
      process.exit(0);
    }
  }

  //^ install dependencies
  const { installDeps } = await prompts({
    type: "toggle",
    name: "installDeps",
    message: "Do you want to install dependencies?",
    initial: true,
    active: "Yes",
    inactive: "No",
  });

  //& Choose the template
  const { template } = await prompts({
    type: "select",
    name: "template",
    message: "Select a template to use:",
    choices: [
      { title: "default", value: "default" },
      // ... add other templates as needed
    ],
  });

  //& Clone the specific template
  const repoUrl = "https://github.com/XevSolutions/menty-templates.git";
  const cloneCommand = `git clone -n --depth=1 --filter=tree:0 --branch main ${repoUrl} ${directory}`;
  const sparseCheckoutCommand = `git -C ${directory} sparse-checkout set --no-cone ${template}`;

  const spinner = ora("Cloning template...").start();
  try {
    await execAsync(cloneCommand);
    await execAsync(sparseCheckoutCommand);
    await execAsync(`git -C ${directory} checkout`);

    if (template !== ".") {
      const templateDir = path.join(directory, template);
      const files = fs.readdirSync(templateDir);
      files.forEach((file) => {
        const oldPath = path.join(templateDir, file);
        const newPath = path.join(directory, file);
        fs.renameSync(oldPath, newPath);
      });
      fs.rmdirSync(templateDir);
    }

    spinner.succeed("Template cloned successfully.");
  } catch (err) {
    spinner.fail("Failed to clone the template.");
    console.error(chalk.red(err));
    process.exit(1);
  }

  //& Install dependencies if the user chose to
  if (installDeps) {
    const installCmd = `cd ${directory} && ${options.yarn ? "yarn" : "npm"} install`;
    execSync(installCmd, { stdio: "inherit" });
  }

  //* Additional instructions for the user
  console.log("");
  console.log(chalk.green("Project setup complete!"));
  console.log(chalk.yellow("To get started, follow these steps:"));
  console.log("");
  console.log(chalk.cyan(`cd ${directory}`));
  !installDeps && console.log(chalk.cyan("npm install"));
  console.log(chalk.cyan("npm run dev"));
  console.log("");
  console.log(chalk.green("Happy coding!"));
}

main();

function execAsync(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, opts, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Execution failed with code ${error.code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

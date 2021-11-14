import { exec } from "@actions/exec";
import hasYarn from "has-yarn";

const INSTALL_STEP = "install";
const BUILD_STEP = "build";

class Term {
	async execSizeLimit(
		branch?: string,
		skipStep?: string,
		buildScript?: string,
		cleanScript?: string,
		windowsVerbatimArguments?: boolean,
		directory?: string
	): Promise<{ status: number; output: string }> {
		const manager = hasYarn(directory) ? "yarn" : "npm";
		let output = "";

		if (branch) {
			console.log(`Checking out branch: ${branch}`)
			try {
				await exec(`git fetch origin ${branch} --depth=1`);
			} catch (error) {
				console.log("Fetch failed", error.message);
			}

			await exec(`git checkout -f ${branch}`);

			try {
				console.log(`Remote update submodules for branch: ${branch}`)
				await exec(`git submodule foreach git remote update`);
			} catch (error) {
				console.error("Failed to update remote for submodules", error.message);
			}

			try {
				console.log(`Fetch submodules for branch: ${branch}`)
				await exec(`git submodule foreach git fetch`);
			} catch (error) {
				console.error("Failed to fetch submodules", error.message);
			}

			try {
				console.log(`Checking out submodules for branch: ${branch}`)
				await exec(`git submodule foreach git checkout --track -b -f ${branch}`);
			} catch (error) {
				console.error("Failed to checkout submodules", error.message);
			}
		}

		if (skipStep !== INSTALL_STEP && skipStep !== BUILD_STEP) {
			await exec(`${manager} install`, [], {
				cwd: directory
			});
		}

		if (skipStep !== BUILD_STEP) {
			const script = buildScript || "build";
			await exec(`${manager} run ${script}`, [], {
				cwd: directory
			});
		}

		const status = await exec("npx size-limit --json", [], {
			windowsVerbatimArguments,
			ignoreReturnCode: true,
			listeners: {
				stdout: (data: Buffer) => {
					output += data.toString();
				}
			},
			cwd: directory
		});

		if (cleanScript) {
			await exec(`${manager} run ${cleanScript}`, [], {
				cwd: directory
			});
		}

		return {
			status,
			output
		};
	}
}

export default Term;

const fs = require("fs-extra")
const path = require("path")
const log = require("@ui5/logger").getLogger("builder:customtask:mvn-dependency-provider")
const util = require("util")
const exec = util.promisify(require("child_process").exec)
const os = require("os")

/**
 * downloads a ui5 sources packed as a .jar and unpacks them to a specific location
 * prominent use case: download a ui5 library packed as a .jar and provide it to the ui5 serve runtime
 *
 * @param {Object} parameters Parameters
 * @param {DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {AbstractReader} parameters.dependencies Reader or Collection to read dependency files
 * @param {Object} parameters.options Options
 * @param {Boolean} [parameters.options.debug=true] verbose output
 * @param {String} [parameters.options.pom="./pom.xml"] path to pom for dependency scraping
 * @param {String} [parameters.options.targetDir="./unpacked-mvn-dependencies"] where to unpack the files in the mvn dep .jars
 * @param {String} [parameters.options.mvnSrcDir=""] subdir in unpacked mvn dependency that will get unpacked to @see targetDir
 * 
 */
module.exports = async function ({ workspace, dependencies, options }) {
    // set defaults
    const isDebug = options?.configuration?.debug || true
    const pomPath = options?.configuration?.pom || "./pom.xml"
    const outputDir = options?.configuration?.targetDir || fs.mkdirpSync("./unpacked-mvn-dependencies")
    const tmpDir = await fs.mkdtemp(path.resolve(`${os.tmpdir()}/mvn-dependency-provider-download`))
    const srcDir = path.resolve(tmpDir, options?.configuration?.mvnSrcDir || "")

    isDebug ? log.info("outputDir", outputDir) : null
    isDebug ? log.info("tmpDir", tmpDir) : null
    isDebug ? log.info("srcDir", srcDir) : null

    // note: mvn creates the dreaded ./target as a ref, so away with it!
    await fs.remove(path.resolve("./target"))

    // download and unpack mvn dependecies to a tmp folder
    try {
        isDebug ? log.info(`unpacking dependencies ${options?.configuration?.groupId.join(",")}...`) : null
        const optionalGroupIds = options?.configuration?.groupId
            ? `-DincludeGroupIds=${options.configuration.groupId.join(",")}`
            : ""
        const stdout = await exec(
            `mvn dependency:unpack-dependencies ${optionalGroupIds} -DoutputDirectory=${tmpDir} -DoverWriteIfNewer=true -f ${pomPath}`
        )
        isDebug ? log.info("stdout", stdout) : null
        isDebug ? log.info(`unpacking dependencies: done!`) : null
    } catch (err) {
        log.error(err)
    }

    // move unpacked sources (or $config.mvnSrcDir within) to $config.targetDir
    try {
        await fs.copy(srcDir, outputDir, { overwrite: true })
        isDebug ? log.info(`successfully unpacked ${srcDir} to ${outputDir}`) : null
    } catch (err) {
        log.error(err)
    }

    // cleanup
    try {
        await Promise.all([
            fs.remove(tmpDir),
            // note: mvn creates the dreaded ./target as a ref, so away with it!
            fs.remove(path.resolve("./target"))
        ])
        isDebug ? log.info(`successfully removed ${tmpDir}`) : null
    } catch (error) {
        log.error(error)
    }
}

/**
 * 
 * @param {object} object Object to pull value from
 * @param {string} path Path to search for
 * @param {string} delimiter Path delimiter
 * @returns {Buffer} file data buffer
 */
function pathToObjectValue(object, path, delimiter='/') {
	return path.split(delimiter).reduce((a, v) => a[v], object);
}
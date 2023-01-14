const earcut = require('earcut');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const cw = canvas.width;
const ch = canvas.height;

const DISPLAY_PADDING = (cw - 128) / 2; // * Images are 128x128
const BORDER_COLOR = 'red';
const CLOSEST_POINT_COLOR = 'black';

let badgeImageData;
let points;
let closestPoint;
let collisionPoints = [];

/**
 * Find outline of non-transparent pixels
 *
 * @param {number} x X coordinate for badgeImageData
 * @param {number} y Y coordinate for badgeImageData
 * @returns {boolean} Is non-transparent
 */
function defineNonTransparent(x, y) {
	const a = badgeImageData[(y*cw+x)*4+3];

	return a > 20;
}

const badgeImage = new Image();
badgeImage.addEventListener('load', () => {
	drawBadgeImage();

	badgeImageData = ctx.getImageData(0, 0, cw, ch).data;

	points = d3.geom.contour(defineNonTransparent);

	ctx.strokeStyle = BORDER_COLOR;
	ctx.lineWidth = 2;

	redraw();
});
badgeImage.src = 'star.png';

/**
 * Draw the original badge image to the canvas
 */
function drawBadgeImage() {
	ctx.drawImage(badgeImage, cw/2-badgeImage.width/2, ch/2-badgeImage.height/2);
}

/**
 * Gets the X coordinate value for the given `i` index
 *
 * @param {number} i Index into the collisionPoints array
 * @returns {number} X coordinate value
 */
function getX(i) {
	return collisionPoints[i][0];
}

/**
 * Gets the Y coordinate value for the given `i` index
 *
 * @param {number} i Index into the collisionPoints array
 * @returns {number} Y coordinate value
 */
function getY(i) {
	return collisionPoints[i][1];
}

/**
 * Redraw the canvas
 */
function redraw() {

	// * Clear canvas of old data
	ctx.clearRect(0, 0, cw, ch);

	drawBadgeImage();

	// * Draw the border
	ctx.beginPath();
	ctx.moveTo(points[0][0], points[0][4]);

	for (let i = 1; i < points.length; i++) {
		const [x, y] = points[i];

		ctx.lineTo(x, y);
	}

	ctx.closePath();
	ctx.stroke();

	// * Draw triangles
	const tris = earcut(collisionPoints.flat());

	ctx.strokeStyle = 'rgba(0,200,0,1)';
	ctx.lineWidth = 0.5;

	for (let i = 0; i < tris.length; i+=3) {
		const p1 = tris[i];
		const p2 = tris[i+1];
		const p3 = tris[i+2];

		ctx.beginPath();
		ctx.moveTo(getX(p1), getY(p1));
		ctx.lineTo(getX(p2), getY(p2));
		ctx.lineTo(getX(p3), getY(p3));
		ctx.closePath();
		ctx.stroke();
	}

	ctx.strokeStyle = BORDER_COLOR;
	ctx.lineWidth = 2;

	// * Draw the closest point
	if (closestPoint) {
		ctx.strokeStyle = CLOSEST_POINT_COLOR;
		ctx.beginPath();
		ctx.arc(closestPoint[0], closestPoint[1], 5, 0, 2 * Math.PI);
		ctx.fill();
		ctx.closePath();
		ctx.strokeStyle = BORDER_COLOR;
	}

	// * Draw existing collision points
	ctx.strokeStyle = CLOSEST_POINT_COLOR;
	for (let i = 0; i < collisionPoints.length; i++) {
		const collisionPoint = collisionPoints[i];
		const [x, y] = collisionPoint;

		ctx.beginPath();
		ctx.arc(x, y, 3, 0, 2 * Math.PI);
		ctx.fill();
		ctx.closePath();
		ctx.fillText(`p${i}`, x+5, y-5);
	}
	ctx.strokeStyle = BORDER_COLOR;
}

/**
 * Finds the distance between 2 points
 *
 * @param {object} p1 Point 1
 * @param {object} p2 Point 2
 * @returns {number} Distance between p1 and p2
 */
function distance(p1, p2) {
	return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

canvas.addEventListener('mousemove', event => {
	// * Adjust mouse position because of padding
	const mousePoint = {
		x: event.clientX-(DISPLAY_PADDING*2),
		y: event.clientY-(DISPLAY_PADDING*2),
	};

	closestPoint = points.reduce((a, b) => {
		const pointA = {
			x: a[0],
			y: a[1]
		};
		const pointB = {
			x: b[0],
			y: b[1]
		};

		return distance(pointA, mousePoint) < distance(pointB, mousePoint) ? a : b;
	});

	redraw();
});

canvas.addEventListener('mouseleave', () => {
	closestPoint = null;

	redraw();
});

canvas.addEventListener('click', () => {
	collisionPoints.push(closestPoint);

	redraw();
});

document.querySelector('#build-collision-mesh').addEventListener('click', () => {
	const tris = earcut(collisionPoints.flat());
	const polygons = [];

	for (let i = 0; i < tris.length; i+=3) {
		const p1 = tris[i];
		const p2 = tris[i+1];
		const p3 = tris[i+2];

		polygons.push([p1, p2, p3]);
	}

	let collision = Buffer.alloc(0x4);

	console.log(polygons.length);

	collision.writeUInt32LE(polygons.length);

	for (let i = 0; i < polygons.length; i++) {
		const polgon = Buffer.alloc(0x4 + 0x40);
		let polygonDataPosition = 0;

		const p1 = polygons[i][0];
		const p2 = polygons[i][1];
		const p3 = polygons[i][2];

		const x1 = getX(p1)-DISPLAY_PADDING;
		const y1 = getY(p1)-DISPLAY_PADDING;

		const x2 = getX(p2)-DISPLAY_PADDING;
		const y2 = getY(p2)-DISPLAY_PADDING;

		const x3 = getX(p3)-DISPLAY_PADDING;
		const y3 = getY(p3)-DISPLAY_PADDING;

		polgon.writeUInt32LE(3, polygonDataPosition); // * Number of verticies is always 3
		polygonDataPosition += 4;

		// * Write all the points
		polgon.writeFloatLE(x1, polygonDataPosition);
		polygonDataPosition += 4;

		polgon.writeFloatLE(y1, polygonDataPosition);
		polygonDataPosition += 4;

		polgon.writeFloatLE(x2, polygonDataPosition);
		polygonDataPosition += 4;

		polgon.writeFloatLE(y2, polygonDataPosition);
		polygonDataPosition += 4;

		polgon.writeFloatLE(x3, polygonDataPosition);
		polygonDataPosition += 4;

		polgon.writeFloatLE(y3, polygonDataPosition);

		collision = Buffer.concat([
			collision,
			polgon
		]);
	}

	// TODO - Change this blob URL downloading to Electron file saving

	// * Create a binary blob from the buffer
	const blob = new Blob([collision], {
		type: 'application/octet-stream'
	});

	// * Download URL
	const url = URL.createObjectURL(blob);

	window.location = url;

	console.log(collision.toString('hex'));
});

document.querySelector('#draw-generated-collision-mesh').addEventListener('click', () => {
	// * Hard-coded collision data for testing
	// * This data was generated using this tool
	// * Doesn't display correctly?
	const collision = Buffer.from('0f0000000300000000001442000014420000544200000040000094420000803f00000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000b842000014420000f242000020420000ee420000744200000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000c6420000a2420000d6420000ce420000e0420000fe4200000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000e0420000fe420000b4420000fe42000078420000d8420000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000078420000d842000020420000fc42000088410000fe420000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000088410000fe42000080410000d8420000f0410000a24200000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000f0410000a2420000204100007442000010410000204200000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000144200001442000094420000803f0000b8420000144200000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000b842000014420000ee42000074420000c6420000a24200000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000c6420000a2420000e0420000fe42000078420000d8420000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000078420000d842000088410000fe420000f0410000a24200000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000f0410000a24200001041000020420000144200001442000000000000000000000000000000000000000000000000000000000000000000000000000000000300000000001442000014420000b842000014420000c6420000a24200000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000c6420000a242000078420000d8420000f0410000a24200000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000f0410000a24200001442000014420000c6420000a24200000000000000000000000000000000000000000000000000000000000000000000000000000000', 'hex');
	const polygons = [];

	const numPolygons = collision.readUInt32LE();

	let polygonPosition = 4;

	for (let i = 0; i < numPolygons; i++) {
		const polygon = [];

		const polygonData = Buffer.from(collision.subarray(polygonPosition, polygonPosition+0x44));

		const numVertices = polygonData.readUInt32LE();
		let polygonDataPosition = 4;

		for (let j = 0; j < numVertices; j++) {
			const x = polygonData.readFloatLE(polygonDataPosition);
			polygonDataPosition += 4;
			const y = polygonData.readFloatLE(polygonDataPosition);
			polygonDataPosition += 4;

			polygon.push([x, y]);
		}

		polygons.push(polygon);

		polygonPosition += 0x44;
	}

	ctx.strokeStyle = 'blue';
	ctx.lineWidth = 0.5;

	for (const polygon of polygons) {
		ctx.beginPath();
		ctx.moveTo(polygon[0][0] + DISPLAY_PADDING, polygon[0][1] + DISPLAY_PADDING);
		ctx.lineTo(polygon[1][0] + DISPLAY_PADDING, polygon[1][1] + DISPLAY_PADDING);
		ctx.lineTo(polygon[2][0] + DISPLAY_PADDING, polygon[2][1] + DISPLAY_PADDING);
		ctx.closePath();
		ctx.stroke();
	}

	ctx.strokeStyle = BORDER_COLOR;
	ctx.lineWidth = 2;
});

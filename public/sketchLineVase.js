let fab;
let xPos, yPos, zPos = null;
let theta = 0;
let radius = 25;

let blobs_recorded = [];


function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  fab = createFab();

  let connectButton = createButton('connect!');
  connectButton.position(20, 20);
  connectButton.mousePressed(function () {
    fab.serial.requestPort(); // choose the serial port to connect to
  });

  let printButton = createButton('stream!');
  printButton.position(20, 60);
  printButton.mousePressed(function () {
    fab.print(); // start streaming the commands to printer
    fab.startTime = Date.now();

    // start recording
    // following https://usefulangle.com/post/354/javascript-record-video-from-camera
    // set MIME type of recording as video/webm
    media_recorder = new MediaRecorder(camera_stream, { mimeType: 'video/webm' });

    // event : new recorded video blob available 
    media_recorder.addEventListener('dataavailable', function (e) {
      blobs_recorded.push(e.data);
    });

    // event : recording stopped & all blobs sent
    media_recorder.addEventListener('stop', function () {
      // create local object URL from the recorded video blobs
      let video_local = URL.createObjectURL(new Blob(blobs_recorded, { type: 'video/webm' }));
      let download_link = document.querySelector("#download-video");
      download_link.href = video_local;
    });

    // start recording with each recorded blob having 1 second video
    media_recorder.start(1000);
  });

  let stopButton = createButton('stop!');
  stopButton.position(20, 100);
  stopButton.mousePressed(function () {
    fab.stopPrint(); // stop streaming the commands to printer
    
    media_recorder.stop();

    // save log file (gcode timestamps)
    let logWriter = createWriter('log.txt');
    fab.log.forEach((logEntry) => logWriter.print(logEntry));
    // close the PrintWriter and save the file
    logWriter.close();

    let gcodeWriter = createWriter('print.gcode')
    fab.sentCommandsFiltered.forEach((code) => gcodeWriter.print(code));
    gcodeWriter.close();

    let stackWriter = createWriter('stack.txt');
    fab.trace.forEach((traceEntry) => stackWriter.print(traceEntry));
    stackWriter.close();

  });


  let cameraButton = createButton('camera!');
  cameraButton.position(20, 140);
  cameraButton.mousePressed(async function () {
    camera_stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    let video = document.querySelector("#video");
    video.srcObject = camera_stream;
  });

}

function fabDraw() {
  // setup!
  fab.setTemps(205, 60);
  fab.setAbsolutePosition(); // set all axes (x.y/z/extruder) to absolute
  fab.setERelative(); // put extruder in relative mode, independent of other axes
  fab.autoHome();
  
  fab.introLine(0.2); // draw to lines on the left side of the print bed

  let startHeight = 0.2;
  let o = 2;
  let s = 40;
  let x = 100;
  let y = 100;
  let sf = 0;
  let maxL = 8;
  let l = 40;
  fab.moveRetract(x, y, startHeight); // move to start
  for (let h = startHeight; h <= maxL; h += o) {
    // lines
    fab.moveExtrude(x + l, y + sf, h, s);
    fab.moveExtrude(x + l - sf, y + l, h, s);
    fab.moveExtrude(x, y + l - sf, h, s);
    fab.moveExtrude(x + sf, y, h, s);

    // dots
    fab.moveExtrude(x, y, h + o, 0.4, 5); // move slowly and extrude lots of filament on the dots
    fab.moveRetract(x + l, y, h, 3 * s); // move quickly from point to point to reduce stringing
    fab.moveExtrude(x + l, y, h + o, 0.4, 5);
    fab.moveRetract(x + l - sf, y + l, h, 3 * s);
    fab.moveExtrude(x + l - sf, y + l, h + o, 0.4, 5);
    fab.moveRetract(x, y + l - sf, h, 3 * s);
    fab.moveExtrude(x, y + l - sf, h + o, 0.4, 5);

    fab.moveRetract(x + sf, y, h + o, s);
  }
}

function draw() {
  orbitControl(2, 2, 0.1);
  background(255);
  fab.render();
}
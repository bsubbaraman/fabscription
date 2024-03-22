<script>
  import CodeMirror from "./CodeMirrorTest.svelte";
  import { javascript } from "@codemirror/lang-javascript";
  import { EditorView } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";

  // This is all a bit clunky for now
  // I should instead generate an e.g. json which contains the gcode, sketch, and video filename
  // Since these will have to be paired up to do the transcription
  let videoValue = "/videoLineVaseDemo.mp4";
  let videoElement;
  let logValue = "log";
  let gcodeValue = "gcode";
  let sketchValue = "sketch";
  let gcodeFileInput;
  let sketchFileInput;
  let traceFileInput;

  let gcodeView; // the gcode CodeMirror component view
  let gcodeLineNum = 0;
  let gcodeLinesToTimeStamps = {};
  let fabscriptionComplete = false;
  let autoScroller = false; // to distinguish editor changes made by user or to auto-advance selection

  let sketchView; // the js CodeMirror component view
  let sketchLineNum = 0;
  let traceLog;

  let midiSpeed;
  let midiExtrusion;
  let midiLoopRadius;

  async function getExampleGcode() {
    let response = await fetch("/printLineVaseDemo.gcode");
    let responseText = await response.text();
    gcodeValue = responseText;
  }

  async function getExampleSketch() {
    let response = await fetch("/sketchLineVase.js");
    let responseText = await response.text();
    sketchValue = responseText;
  }

  async function getExampleLog() {
    let response = await fetch("/logLineVaseDemo.txt");
    let responseText = await response.text();
    logValue = responseText;
  }

  async function getExampleStack() {
    let response = await fetch("/stackLineVaseDemo.txt");
    let responseText = await response.text();
    traceLog = responseText.split("\n");
  }

  async function getExampleMidi1() {
    let response = await fetch("/midiSpeedCHI.txt");
    let responseText = await response.text();
    midiSpeed = responseText.split("\n");
  }

  async function getExampleMidi2() {
    let response = await fetch("/midiExtrusionCHI.txt");
    let responseText = await response.text();
    midiExtrusion = responseText.split("\n");
  }

  async function getExampleMidi3() {
    let response = await fetch("/midiLoopRadiusCHI.txt");
    let responseText = await response.text();
    midiLoopRadius = responseText.split("\n");
  }

  async function onGcodeFileSelected(e) {
    fabscribe();
    // let gcode = e.target.files[0];
    // const reader = new FileReader();
    // reader.onload = handleGcodeFileLoad;
    // reader.readAsText(gcode);
  }

  function handleGcodeFileLoad(event) {
    gcodeValue = event.target.result;
    fabscribe();
  }

  async function onSketchFileSelected(e) {
    let gcode = e.target.files[0];
    const reader = new FileReader();
    reader.onload = handleSketchFileLoad;
    reader.readAsText(gcode);
  }

  function handleSketchFileLoad(event) {
    sketchValue = event.target.result;
  }

  async function onTraceFileSelected(e) {
    let traceLog = e.target.files[0];
    const reader = new FileReader();
    reader.onload = handleTraceFileLoad;
    reader.readAsText(traceLog);
  }

  function handleTraceFileLoad(event) {
    traceLog = event.target.result;
    traceLog = traceLog.split("\n");
    console.log(traceLog);
  }

  function calcDistance(p1, p2) {
    const X = p2[0] - p1[0];
    const Y = p2[1] - p1[1];
    const Z = p2[2] - p1[2];
    const E = p2[3] - p1[3];
    return Math.sqrt(X * X + Y * Y + Z * Z + E * E);
  }

  function fabscribe() {
    // First gather all position data from the gcode
    let commands = gcodeValue.split("\n");
    let gcodePositionData = [];
    let position = [0, 0, 0, 0]; // need to account for G92 setting these
    let relativeDimensionalPositioning = false;
    let relativeExtrusion = true;
    commands.forEach((command) => {
      let fields = command.split(" ");
      let xPos, yPos, zPos, ePos;
      // account for changes in positioning
      switch (fields[0]) {
        case "M82":
          relativeExtrusion = false;
          break;
        case "M83":
          console.log("setting relative extrusion");
          relativeExtrusion = true;
          break;
        case "G90":
          relativeDimensionalPositioning = false;
          break;
        case "G91":
          relativeDimensionalPositioning = true;
          break;
      }
      
      if (["G0", "G1"].includes(fields[0])) {
        fields.forEach((field) => {
          let fieldValue = field.substring(1);
          switch (field.charAt(0)) {
            case "X":
              xPos = fieldValue;
              break;
            case "Y":
              yPos = fieldValue;
              break;
            case "Z":
              zPos = fieldValue;
              break;
            case "E":
              // E is in relative, so have to keep track of relative/absolute mode to do this
              // adding proof of concept, will probably need more testing
              // also implementing relative mode for other dimensional axes
              ePos = fieldValue;
              break;
          }
        });

        // if the move command didn't specify a pos for a dimension, inherit last value
        if (relativeDimensionalPositioning) {
          xPos = xPos ? Number(xPos) + Number(position[0]) : position[0];
          yPos = yPos ? Number(yPos) + Number(position[1]) : position[1];
          zPos = zPos ? Number(zPos) + Number(position[2]) : position[2];
        } else {
          // i.e. absolute dimensional positioning
          xPos = xPos ? xPos : position[0];
          yPos = yPos ? yPos : position[1];
          zPos = zPos ? zPos : position[2];
        }
        if (relativeExtrusion) {
          ePos = ePos ? Number(ePos) + Number(position[3]) : position[3];
        } else {
          // i.e. absolute extrusion
          ePos = ePos ? ePos : position[3];
        }
        position = [xPos, yPos, zPos, ePos];
        gcodePositionData.push(position);
      } else {
        gcodePositionData.push(null);
      }
      // console.log(gcodePositionData);
    });

    // Now gather position data from the log file alongside timestamps
    let logPositionData = [];
    let logEntries = logValue.split("\n");
    logEntries.forEach((entry) => {
      let entryData = entry.split(",");
      let timestamp = entryData[0];
      let fields = entryData[1].split(" ");
      let xPos, yPos, zPos, ePos;
      fields.forEach((field) => {
        let fieldValue = field.substring(2);
        switch (field.charAt(0)) {
          case "X":
            xPos = fieldValue;
            break;
          case "Y":
            yPos = fieldValue;
            break;
          case "Z":
            zPos = fieldValue;
            break;
          case "E":
            ePos = fieldValue;
        }
      });
      logPositionData.push([timestamp, [xPos, yPos, zPos, ePos]]);
    });

    console.log('match time stamps')
    // Now match timestamps to gcode lines
    gcodeLinesToTimeStamps = {};
    for (let index = 0; index < gcodePositionData.length; index++) {
      console.log(index, 'of', gcodePositionData.length)
      let gcodePos = gcodePositionData[index];
      if (gcodePos) {
        // some lines are null
        let minDist = 500;
        let gcodeLineNum = null;
        let timestamp = null;
        for (let j = 0; j < logPositionData.length; j++) {
          let positionData = logPositionData[j];
          let logPos = positionData[1];
          let dist = calcDistance(gcodePos, logPos);
          if (dist < minDist) {
            minDist = dist;
            gcodeLineNum = index;
            timestamp = positionData[0];
          }
        }
        gcodeLinesToTimeStamps[Number(gcodeLineNum + 1)] = timestamp;
      }
    }
    console.log("fabscription results:");
    console.log(gcodeLinesToTimeStamps);
    
    makeMidiViz(); // added

    fabscriptionComplete = true;
  }

  function makeMidiViz() {
    // Initialize the echarts instance based on the prepared dom
    console.log("making midi viz");
    var midiSpeedChart = echarts.init(
      document.getElementsByClassName("midi")[0],
    );
    // var midiExtrusionChart = echarts.init(
    //   document.getElementsByClassName("midi")[1],
    // );
    // var midiRadiusChart = echarts.init(
    //   document.getElementsByClassName("midi")[2],
    // );

    // read in the data
    let midiTimeStamps = []; // all midi data comes in at once/share timestamps
    let midiLoopData = [];
    let midiSpeedData = [];
    let midiExtrusionData = [];
    
    // midiTimeStamps.push(0);
    // midiSpeedData.push(null);
    // midiExtrusionData.push(null);
    // midiLoopData.push(null);

    midiSpeed.forEach((entry) => {
      let entryData = entry.split(",");
      let timestamp = entryData[0] / 1000; // ms to s
      let value = entryData[1] / 60; // mm/min to mm/sec
      midiTimeStamps.push(timestamp);
      midiSpeedData.push(value.toFixed(2));
    });

    midiExtrusion.forEach((entry) => {
      let entryData = entry.split(",");
      let value = entryData[1];
      midiExtrusionData.push(value);
    });

    midiLoopRadius.forEach((entry) => {
      let entryData = entry.split(",");
      let value = entryData[1];
      midiLoopData.push(value);
    });

    // midiTimeStamps.push(Math.ceil(midiTimeStamps[midiTimeStamps.length-1]));


    // // Specify the configuration items and data for the chart
    // var optionSpeed = {
    //   tooltip: {
    //     trigger: "axis",
    //   },
    //   xAxis: {
    //     data: midiTimeStamps,
    //     show: false,
    //   },
    //   yAxis: {
    //     type: "value",
    //     name: "Speed \n (mm/sec)",
    //     nameTextStyle: {
    //       fontSize: "16",
    //     },
    //     nameLocation: "center",
    //     nameGap: 50,
    //     splitLine: {
    //       show: false,
    //     },
    //     axisTick: { show: false },
    //     show: false,
    //   },
    //   series: {
    //     name: "Speed",
    //     type: "line",
    //     showSymbol: false,
    //     data: midiSpeedData,
    //     lineStyle: {color: '#FF6700'}
    //   },
    // };

    // var optionExtrusion = {
    //   tooltip: {
    //     trigger: "axis",
    //   },
    //   xAxis: {
    //     data: midiTimeStamps,
    //     show: false,
    //   },
    //   yAxis: {
    //     type: "value",
    //     name: "Extrusion \n Multiplier",
    //     nameTextStyle: {
    //       fontSize: "16",
    //     },
    //     nameLocation: "center",
    //     nameGap: 50,
    //     splitLine: {
    //       show: false,
    //     },
    //     axisTick: { show: false },
    //     show: false,
    //   },
    //   series: {
    //     name: "Extrusion",
    //     type: "line",
    //     showSymbol: false,
    //     data: midiExtrusionData,
    //     lineStyle: {color: '#00FF67'}
    //   },
    // };

    // var optionRadius = {
    //   tooltip: {
    //     trigger: "axis",
    //   },
    //   xAxis: {
    //     data: midiTimeStamps,
    //     min: 0,
    //   },
    //   yAxis: {
    //     type: "value",
    //     name: "Loop Radius \n (mm)",
    //     nameTextStyle: {
    //       fontSize: "16",
    //     },
    //     nameLocation: "center",
    //     nameGap: 50,
    //     splitLine: {
    //       show: false,
    //     },
    //     show: false,
    //   },
    //   series: {
    //     name: "Loop Radius",
    //     type: "line",
    //     showSymbol: false,
    //     data: midiLoopData,
    //     lineStyle: {color: '#6700FF'}
    //   },
    // };

    var option = {
      tooltip: {
        trigger: "axis",
      },
      xAxis: [
        {
          data: midiTimeStamps,
          show: false,
        },
      ],
      yAxis: [
        {
          type: "value",
          show: false,
          name: "Speed",
          position: "right",
          alignTicks: false,
        },
        {
          type: "value",
          show: false,
          name: "Extrusion",
          position: "right",
          alignTicks: false,
        },
        {
          type: "value",
          show: false,
          name: "Loop Radius",
          alignTicks: false,
        },
      ],
      series: [
        {
          name: "Speed (mm/sec)",
          type: "line",
          data: midiSpeedData,
        },
        {
          name: "Extrusion Multiplier",
          type: "line",
          yAxisIndex: 1,
          data: midiExtrusionData,
        },
        {
          name: "Loop Radius (mm)",
          type: "line",
          yAxisIndex: 2,
          data: midiLoopData,
        },
      ],
    };

    // Display the chart using the configuration items and data just specified.
    midiSpeedChart.setOption(option);
    // midiExtrusionChart.setOption(optionExtrusion);
    // midiRadiusChart.setOption(optionRadius);
  }

  getExampleGcode();
  getExampleSketch();
  getExampleLog();
  getExampleStack();

  getExampleMidi1();
  getExampleMidi2();
  getExampleMidi3();

  // fabscribe();

  // CODEMIRROR EXTENSION
  function getLineSelection() {
    return EditorView.updateListener.of((update) => {
      let updatedgcodeLineNum = update.view.state.doc.lineAt(
        update.view.state.selection.main.head,
      ).number;
      if (gcodeLineNum != updatedgcodeLineNum) {
        gcodeLineNum = updatedgcodeLineNum;
        syncSketchLine(gcodeLineNum);
        if (!autoScroller) {
          gcodeSelectionToVideoTimeStamp(gcodeLineNum);
        }
      }
    });
  }

  function gcodeSelectionToVideoTimeStamp(l) {
    // the timestamp for a line maps to when that command complete
    // so navigate to the previous keys timestamp for the start of this command
    if (gcodeLinesToTimeStamps[l]) {
      let sortedData = Object.keys(gcodeLinesToTimeStamps).sort(
        function (a, b) {
          return a - b;
        },
      );

      var loc = sortedData.indexOf(String(l));
      if (loc > 0) {
        let startOfCommand = gcodeLinesToTimeStamps[sortedData[loc - 1]] / 1000; // milliseconds to seconds
        let isPaused = videoElement.paused;
        videoElement.pause();
        videoElement.currentTime = startOfCommand;
        if (!isPaused) {
          videoElement.play();
        }
      }
    }
  }

  function timeStampToGcodeLine(event) {
    let currentTime = videoElement.currentTime;
    // assume the data is chronological, find the time interval which the current time fits into
    // look into the most efficient way to do this
    for (var gcodeLine in gcodeLinesToTimeStamps) {
      let t = gcodeLinesToTimeStamps[gcodeLine] / 1000; // milliseconds to seconds
      if (t >= currentTime) {
        const line = gcodeView.state.doc.line(gcodeLine);
        autoScroller = true;
        gcodeView.dispatch({
          // Set selection to that entire line.
          selection: { head: line.from, anchor: line.to },
          // Ensure the selection is shown in viewport
          scrollIntoView: true,
        });
        autoScroller = false;
        break;
      }
    }
  }

  function syncSketchLine(gcodeLine) {
    if (traceLog) {
      // trace log currently has the complete gcode line and the line number seperated by a comma
      // probably don't need the full gcode line?
      // remove if statement once i use a consolidated log file format
      let sketchLineNum = traceLog[gcodeLine].split(",")[1];

      const sketchLine = sketchView.state.doc.line(sketchLineNum);
      sketchView.dispatch({
        // Set selection to that entire line.
        selection: { head: sketchLine.from, anchor: sketchLine.to },
        // Ensure the selection is shown in viewport
        scrollIntoView: true,
      });
    }
  }
</script>

<main>
  <!-- <h1>Fabscription</h1>
  <div>
    <p>
      Scrub video documentation of a fabrication process in lockstep with
      machine instructions and source code.
    </p>
  </div> -->

  <div class="panels">
    <div class="code-previews">
      <div class="panel code-preview">
        <div class="section-head">
          <h3>GCode</h3>
          <div>
            <button on:click={() => fabscribe()}>Fabscribe!</button>
            <!-- <button on:click={() => gcodeFileInput.click()}>Set GCode</button>
            <input
              type="file"
              accept=".gcode"
              on:change={(e) => onGcodeFileSelected(e)}
              bind:this={gcodeFileInput}
              style="display: none;"
            /> -->
          </div>
        </div>
        <div>
          <CodeMirror
            bind:value={gcodeValue}
            bind:view={gcodeView}
            lang={javascript()}
            styles={{
              "&": {
                width: "100%",
                maxWidth: "100%",
                //maxHeight: "33vh",
                maxHeight: "31vh",
              },
            }}
            extensions={[getLineSelection()]}
          />
        </div>
      </div>

      <div class="panel bottom-panel code-preview">
        <div class="section-head">
          <h3>Sketch</h3>
          <div>
            <!-- <button on:click={() => sketchFileInput.click()}>Set Sketch</button>
            <input
              type="file"
              accept=".js"
              on:change={(e) => onSketchFileSelected(e)}
              bind:this={sketchFileInput}
              style="display: none;"
            />
            <button on:click={() => traceFileInput.click()}>Set Trace</button>
            <input
              type="file"
              accept=".txt"
              on:change={(e) => onTraceFileSelected(e)}
              bind:this={traceFileInput}
              style="display: none;"
            /> -->
          </div>
        </div>
        <div>
          <CodeMirror
            bind:value={sketchValue}
            bind:view={sketchView}
            lang={javascript()}
            styles={{
              "&": {
                width: "100%",
                maxWidth: "100%",
                maxHeight: "31vh",
                // maxHeight: "28vh",
              },
            }}
          />
        </div>
      </div>
    </div>

    <div class="preview">
      <!-- <div class="section-head">
        <h3>Video</h3>
      </div> -->
      <div class="vid-holder">
        <!-- svelte-ignore a11y-media-has-caption -->
        <video
          bind:this={videoElement}
          on:timeupdate={timeStampToGcodeLine}
          controls
          src={videoValue}
        />
      </div>
    </div>
  </div>

  <!-- Add midi viz -->
  <!-- <div class="panel midi-panels">
    <div class="section-head">
      <h3>MIDI</h3>
    </div>
    <div class="midi"></div>
  </div> -->
</main>

<style>
  main {
    /* padding: 10px; */
    margin: 10px;
    font-family: "Inter", sans-serif;
    color: #0f0f0f;
    margin-bottom: 5%;
  }

  .panels {
    display: flex;
    height: 66.5vh; 
    /* height: 60vh; */
  }

  .panel {
    border: 3px solid #aeb3f7;
    background-color: rgb(245, 245, 245);
    box-sizing: border-box;
    margin-top: 5px;
    margin-bottom: 5px;
  }

  .bottom-panel {
    margin-top: 15px;
  }

  .code-previews {
    width: 40%;
    height: 100%;
    margin-right: 2%;
  }

  .code-preview {
    width: 100%;
    height: 55.6%;
    display: flex;
    flex-direction: column;
  }

  .preview {
    flex-grow: 1;
    margin-top: 5px;
    height: 100%;
    margin-bottom: 10px;
  }

  .midi-panels {
    display: block;
    margin-top: 100px;
    width: 100%;
    height: 275px;
  }

  .midi {
    display: block;
    margin-bottom: -10%;
    margin-top: -1%;
    width: 100%;
    height: 300px;
  }

  .vid-holder {
    flex: 1;
    display: flex;
    width: 100%;
    /* margin-left: 2%; */
    position: relative;
    border: 3px solid #aeb3f7;
    /* height: 95%; */
  }

  video {
    width: 50%;
    /* transform: translateY(12%); */
  }

  .preview video {
    background-color: #000;
    flex: 1;
  }

  .section-head {
    display: flex;
    justify-content: stretch;
    margin: 5px;
  }

  .section-head h3 {
    flex: 1;
  }

  h1,
  h3 {
    font-weight: normal;
    margin: 0;
    padding: 0;
  }

  h1 {
    margin-bottom: 5px;
  }

  h3 {
    margin-bottom: 10px;
  }
</style>
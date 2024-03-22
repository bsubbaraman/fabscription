<script>
  import CodeMirror from "./CodeMirrorTest.svelte";
  import { javascript } from "@codemirror/lang-javascript";
  import { EditorView } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";
  import { onMount } from "svelte";

  // try doing it cleaner here
  const state = {
    fabLog: "./fablog1.json",
    sketch: "./sketchFablog1.js",
    gcodeText: null,

    videoValue: "./videoFablog1.webm", // put a default value here
    videoElement: null,
    gcodeView: null, // the codemirror component view
    sketchView: null,
    fabscriptionComplete: false,
    chart: null,
  };

  let gcodeLineNum = 0;
  let gcodeLinesToTimeStamps = {};
  let autoScroller = false;

  function calcDistance(p1, p2) {
    const X = p2[0] - p1[0];
    const Y = p2[1] - p1[1];
    const Z = p2[2] - p1[2];
    const E = p2[3] - p1[3];
    return Math.sqrt(X * X + Y * Y + Z * Z + E * E);
  }

  function fabscribe() {
    // First gather all position data from the gcode
    let commands = state.fabLog.gcode; // gcodeValue.split("\n");
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

        // if the move command didn't specify a pos for a dimension, keep last value
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
    let logEntries = state.fabLog.log;
    logEntries.forEach((entryData) => {
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

    console.log("match time stamps");
    // Now match timestamps to gcode lines
    gcodeLinesToTimeStamps = {};
    for (let index = 0; index < gcodePositionData.length; index++) {
      console.log(index, "of", gcodePositionData.length);
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
    window.onresize = function () {
      state.chart.resize();
    };

    state.fabscriptionComplete = true;
  }

  function makeMidiViz() {
    // Initialize the echarts instance based on the prepared dom
    console.log("making midi viz");
    state.chart = echarts.init(document.getElementsByClassName("midiviz")[0]);

    let formattedMidiData = {}; // get it set up for graphing
    formattedMidiData.timestamps = []; // all midi data comes in at once/share timestamps
    formattedMidiData.values = {};
    let getTimestamps = true;
    for (const parameter in state.fabLog.midi) {
      formattedMidiData.values[parameter] = [];
      let midiData = state.fabLog.midi[parameter];
      midiData.forEach((entry) => {
        let [timestamp, value] = entry;
        if (getTimestamps) {
          timestamp /= 1000; // ms to s
          formattedMidiData.timestamps.push(timestamp);
        }
        formattedMidiData.values[parameter].push(value);
      });
      getTimestamps = false;
    }

    var option = {
      tooltip: {
        trigger: "axis",
      },
      xAxis: [
        {
          data: formattedMidiData.timestamps,
          show: false,
        },
      ],
      yAxis: [],
      series: [],
    };

    // Add in the midi data
    let yAxisIdx = 0;
    for (const parameter in formattedMidiData.values) {
      let yAxisOption = {
        type: "value",
        show: false,
        position: "right",
        alignTicks: false,
        name: parameter,
      };
      let seriesOption = {
        name: parameter,
        type: "line",
        data: formattedMidiData.values[parameter],
        yAxisIdx: yAxisIdx,
      };

      option.yAxis.push(yAxisOption);
      option.series.push(seriesOption);
      yAxisIdx += 1;
    }

    // Display the chart using the configuration items and data just specified.
    state.chart.setOption(option);
  }

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
        let isPaused = state.videoElement.paused;
        state.videoElement.pause();
        state.videoElement.currentTime = startOfCommand;
        if (!isPaused) {
          state.videoElement.play();
        }
      }
    }
  }

  function timeStampToGcodeLine(event) {
    let currentTime = state.videoElement.currentTime;
    // assume the data is chronological, find the time interval which the current time fits into
    // look into the most efficient way to do this
    for (var gcodeLine in gcodeLinesToTimeStamps) {
      let t = gcodeLinesToTimeStamps[gcodeLine] / 1000; // milliseconds to seconds
      if (t >= currentTime) {
        const line = state.gcodeView.state.doc.line(gcodeLine);
        autoScroller = true;
        state.gcodeView.dispatch({
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
    if (state.fabLog.stack) {
      let sketchLineNum = state.fabLog.stack[gcodeLine][1];
      const sketchLine = state.sketchView.state.doc.line(sketchLineNum);
      state.sketchView.dispatch({
        selection: { head: sketchLine.from, anchor: sketchLine.to }, // Set selection to that entire line.
        scrollIntoView: true, // Ensure the selection is shown in viewport
      });
    }
  }

  onMount(() => {
    document
      .getElementById("logUpload")
      .addEventListener("change", handleLogSelect, false);
    document
      .getElementById("vidUpload")
      .addEventListener("change", handleVidSelect, false);

    setup();
  });

  async function setup() {
    let logResponse = await fetch(state.fabLog);
    let logResponseText = await logResponse.text();
    state.fabLog = JSON.parse(logResponseText);

    let sketchResponse = await fetch(state.sketch);
    let sketchResponseText = await sketchResponse.text();
    state.sketch = sketchResponseText;

    setGcodeText();

    fabscribe();
  }

  function setGcodeText() {
    state.gcodeText = state.fabLog.gcode.join("\n");
  }

  function handleVidSelect(event) {
    const file = event.target.files[0];
    const url = URL.createObjectURL(file);
    state.videoValue = url;
  }

  function handleLogSelect(event) {
    const reader = new FileReader();
    reader.onload = handleLogLoad;
    reader.readAsText(event.target.files[0]);
  }

  function handleLogLoad(event) {
    state.fabLog = JSON.parse(event.target.result);
  }
</script>

<main>
  <div class="editor">
    <div class="panel title">
      <div class="panel-contents">
        <h2>Fabscription</h2>
        <p>
          Scrub video documentation of a fabrication process in lockstep with
          machine instructions and source code.
        </p>
        <label for="logUpload">Upload log file</label>
        <input type="file" id="logUpload" name="logUpload" accept=".json" />
        <label for="vidUpload">Upload video</label>
        <input type="file" id="vidUpload" name="vidUpload" accept=".webm" />
        <button on:click={() => fabscribe()}>Fabscribe!</button>
      </div>
    </div>
    <div class="panel sketch">
      <div class="panel-contents">
        <h3>GCode</h3>
      </div>
      <CodeMirror
        bind:value={state.gcodeText}
        bind:view={state.gcodeView}
        lang={javascript()}
        styles={{
          "&": {
            width: "100%",
            maxWidth: "100%",
            maxHeight: "26vh",
          },
        }}
        extensions={[getLineSelection()]}
      />
    </div>
    <div class="panel gcode">
      <div class="panel-contents">
        <h3>Sketch</h3>
      </div>
      <CodeMirror
        bind:value={state.sketch}
        bind:view={state.sketchView}
        lang={javascript()}
        styles={{
          "&": {
            width: "100%",
            maxWidth: "100%",
            maxHeight: "26vh",
          },
        }}
      />
    </div>
    <div class="panel recording">
      <!-- svelte-ignore a11y-media-has-caption -->
      <div class="video-wrapper">
        <video
          bind:this={state.videoElement}
          on:timeupdate={timeStampToGcodeLine}
          controls
          src={state.videoValue}
        />
      </div>
    </div>
    <div class="panel midiviz">
      <div class="panel-contents">
        <h3>MIDI</h3>
      </div>
    </div>
  </div>
</main>

<style>
  main {
    /* padding: 10px; */
    margin: 10px;
    font-family: "Inter", sans-serif;
    color: #0f0f0f;
    margin-bottom: 5%;
  }

  .editor {
    display: grid;
    margin: 10px;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(6, 1fr);
    grid-column-gap: 5px;
    grid-row-gap: 5px;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .title {
    grid-area: 1 / 1 / 2 / 5;
  }

  .sketch {
    grid-area: 2 / 1 / 4 / 3;
  }

  .gcode {
    grid-area: 4 / 1 / 6 / 3;
  }

  .recording {
    grid-area: 2 / 3 / 6 / 5;
  }

  .midiviz {
    grid-area: 6 / 1 / 7 / 5;
  }

  .video-wrapper {
    display: flex;
    height: calc(100% - 60px);
    margin: 10px;
  }

  video {
    object-fit: contain;
    width: 100%;
    height: 100%;
  }

  .panel {
    border: 3px solid #aeb3f7;
    background-color: rgb(245, 245, 245);
    box-sizing: border-box;
    /* margin: 5px; */
  }

  .panel-contents {
    margin: 10px;
    z-index: 100;
  }

  h1,
  h2,
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

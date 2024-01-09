<script>
  // import CodeMirror from "svelte-codemirror-editor";
  import CodeMirror from "./CodeMirrorTest.svelte";
  import { javascript } from "@codemirror/lang-javascript";
  import { EditorView, keymap } from "@codemirror/view";
  // import("@codemirror/state").EditorStateConfig;
  import { EditorState } from "@codemirror/state";

  // This is all a bit clunky for now
  // I should instead generate an e.g. json which contains the gcode, sketch, and video filename
  // Since these will have to be paired up to do the transcription
  let videoValue = "/videoLineVase.mp4";
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

  async function getExampleGcode() {
    let response = await fetch("/printLineVase.gcode");
    let responseText = await response.text();
    gcodeValue = responseText;
  }

  async function getExampleSketch() {
    let response = await fetch("/sketchLineVase.js");
    let responseText = await response.text();
    sketchValue = responseText;
  }

  async function getExampleLog() {
    let response = await fetch("/logLineVase.txt");
    let responseText = await response.text();
    logValue = responseText;
  }

  async function onGcodeFileSelected(e) {
    let gcode = e.target.files[0];
    const reader = new FileReader();
    reader.onload = handleGcodeFileLoad;
    reader.readAsText(gcode);
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
          console.log('setting relative extrusion');
          relativeExtrusion = true;
          break;
        case "G90":
          relativeDimensionalPositioning = false;
          break;
        case "G91":
          relativeDimensionalPositioning = true;
          break;
      }
      console.log('done with that swtich')
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
        }
        else {
          // i.e. absolute extrusion
          ePos = ePos ? ePos : position[3];
        }
        position = [xPos, yPos, zPos, ePos];
        gcodePositionData.push(position);
      } else {
        gcodePositionData.push(null);
      }
      console.log(gcodePositionData);
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

    // Now match timestamps to gcode lines
    gcodeLinesToTimeStamps = {};
    for (let index = 0; index < gcodePositionData.length; index++) {
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
    fabscriptionComplete = true;
  }

  getExampleGcode();
  getExampleSketch();
  getExampleLog();

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
        videoElement.pause();
        videoElement.currentTime = startOfCommand;
        videoElement.play();
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

  // example keybinding extension
  // function my_ext() {
  //   return keymap.of([
  //     {
  //       key: "T",
  //       run(view) {
  //         lineNum = view.state.doc.lineAt(
  //           view.state.selection.main.head,
  //         ).number;
  //         console.log("linenum is:", lineNum);
  //       },
  //     },
  //   ]);
  // }
</script>

<main>
  <h1>Fabscription</h1>
  <div>
    <p>
      Scrub video documentation of a fabrication process in lockstep with
      machine instructions and source code.
    </p>
  </div>

  <div class="panels">
    <div class="code-previews">
      <div class="panel code-preview">
        <div class="section-head">
          <h3>GCode</h3>
          <div>
            <button on:click={() => gcodeFileInput.click()}>Set GCode</button>
            <input
              type="file"
              accept=".gcode"
              on:change={(e) => onGcodeFileSelected(e)}
              bind:this={gcodeFileInput}
              style="display: none;"
            />
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
                maxHeight: "33vh",
              },
            }}
            extensions={[getLineSelection()]}
          />
        </div>
      </div>

      <div class="panel code-preview">
        <div class="section-head">
          <h3>Sketch</h3>
          <div>
            <button on:click={() => sketchFileInput.click()}>Set Sketch</button>
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
            />
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
                maxHeight: "33vh",
              },
            }}
          />
        </div>
      </div>
    </div>

    <div class="panel preview">
      <div class="section-head">
        <h3>Video</h3>
      </div>
      <div class="vid-holder">
        <video
          bind:this={videoElement}
          on:timeupdate={timeStampToGcodeLine}
          controls
          src={videoValue}
        />
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

  .panels {
    display: flex;
    height: 80vh;
  }

  .panel {
    border: 3px solid #aeb3f7;
    background-color: rgb(245, 245, 245);
    box-sizing: border-box;
    margin-top: 5px;
    margin-bottom: 5px;
  }

  .code-previews {
    width: 50%;
    height: 100%;
    margin-right: 2%;
  }

  .code-preview {
    width: 100%;
    height: 50%;
    display: flex;
    flex-direction: column;
  }

  .preview {
    flex-grow: 1;
    margin-top: 5px;
    height: 100%;
    margin-bottom: 10px;
  }

  .vid-holder {
    flex: 1;
    display: flex;
    width: 95%;
    margin: auto;
    position: relative;
    /* height: 95%; */
  }

  video {
    /* bottom: 50%; */
    /* transform: translateY(12%); */
  }

  .preview video {
    width: 100%;
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

// Define the chart dimensions
const width = 1200; // Increased width
const height = 1200; // Increased height

// Create the color scale
const color = d3.scaleLinear()
    .domain([0, 5])
    .range(["hsl(152,80%,80%)", "hsl(228,30%,40%)"])
    .interpolate(d3.interpolateHcl);

// Define the pack layout
const pack = (data) => 
  d3.pack()
    .size([width, height])
    .padding(5)
    (d3.hierarchy(data)
      .sum((d) => Array.isArray(d.value) ? d.value.length : 1)
      .sort((a, b) => b.value - a.value));

// Load the JSON data
d3.json("../Data/data.json").then((data) => {
  const root = pack(data);

  // Initialize SVG
  const svg = d3.select("#visualization")
    .append("svg")
    .attr("viewBox", `-${width / 2} -${height / 2} ${width} ${height}`)
    .attr("width", width)
    .attr("height", height)
    .style("background", color(0))
    .style("cursor", "pointer");

  // Append circles
  const node = svg.append("g")
    .selectAll("circle")
    .data(root.descendants().slice(1))
    .join("circle")
      .attr("fill", (d) => (d.children ? color(d.depth) : "white"))
      .attr("pointer-events", (d) => (!d.children ? "none" : null))
      .on("mouseover", function () {
        d3.select(this).attr("stroke", "#000").attr("stroke-width", 2);
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke", null);
      })
      .on("click", (event, d) => {
        if (d.children) zoom(event, d);
        else if (d.data.value && typeof d.data.value === "object") showValuesByYear(d);
      });

  // Append text labels
  const label = svg.append("g")
    .style("font", "12px sans-serif")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .selectAll("text")
    .data(root.descendants())
    .join("text")
      .style("fill-opacity", (d) => (d.parent === root ? 1 : 0))
      .style("display", (d) => (d.parent === root ? "inline" : "none"))
      .text((d) => d.data.name);

  let focus = root;
  let view;

  // Zoom function
  function zoom(event, d) {
    const focus0 = focus;
    focus = d;

    const transition = svg.transition()
      .duration(750)
      .tween("zoom", () => {
        const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
        return (t) => zoomTo(i(t));
      });

    label
      .filter(function(d) {
        return d.parent === focus || (this.style && this.style.display === "inline");
      })
      .transition(transition)
      .style("fill-opacity", (d) => (d.parent === focus ? 1 : 0))
      .on("start", function(d) {
        if (d.parent === focus) this.style.display = "inline";
      })
      .on("end", function(d) {
        if (d.parent !== focus) this.style.display = "none";
      });
  }

  // Zoom helper function
  function zoomTo(v) {
    const k = width / v[2];
    view = v;

    label.attr("transform", (d) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
    node.attr("transform", (d) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
    node.attr("r", (d) => d.r * k);
  }

  // Show values for a specific measure by year
  function showValuesByYear(d) {
    const yearFilter = d3.select("#yearFilter").property("value");
    const values = yearFilter
      ? d.data.value[yearFilter] || []
      : Object.entries(d.data.value)
          .map(([year, vals]) => `${year}: ${vals.join(", ")}`)
          .join("\n");

    alert(`Measure: ${d.data.name}\nValues:\n${values || "No data available for the selected year."}`);
  }

  // Populate the year filter dropdown
  const yearFilterDropdown = d3.select("#yearFilter");
  const years = [...new Set(root.descendants()
    .filter((d) => d.data.value && typeof d.data.value === "object")
    .flatMap((d) => Object.keys(d.data.value))
  )];
  yearFilterDropdown
    .selectAll("option")
    .data(["", ...years])
    .join("option")
    .attr("value", (d) => d)
    .text((d) => (d ? d : "All Years"));

  // Initial zoom setup
  zoomTo([root.x, root.y, root.r * 2]);
});

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addCollection("essays", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/essays/*.md").reverse();
  });
  eleventyConfig.addFilter("monthYear", function(date) {
    const d = new Date(date);
    const months = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
    return months[d.getMonth()] + " " + d.getFullYear();
  });
  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    },
    pathPrefix: "/notes/",
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};

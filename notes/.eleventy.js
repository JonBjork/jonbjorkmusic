module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addCollection("essays", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/essays/*.md").reverse();
  });
  eleventyConfig.addCollection("licks", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/licks/*.md").sort(function(a, b) {
      return (parseInt(b.fileSlug, 10) || 0) - (parseInt(a.fileSlug, 10) || 0);
    });
  });
  function techSlug(s) {
    return String(s).toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  eleventyConfig.addFilter("techSlug", techSlug);
  eleventyConfig.addCollection("techniques", function(collectionApi) {
    var licks = collectionApi.getFilteredByGlob("src/licks/*.md");
    var map = {};
    licks.forEach(function(l) {
      (l.data.techniques || []).forEach(function(t) {
        var slug = techSlug(t);
        if (!map[slug]) map[slug] = { name: t, slug: slug, licks: [] };
        map[slug].licks.push(l);
      });
    });
    return Object.keys(map).map(function(k) { return map[k]; })
      .sort(function(a, b) { return a.name.localeCompare(b.name); })
      .map(function(g) {
        g.licks.sort(function(a, b) { return (parseInt(b.fileSlug, 10) || 0) - (parseInt(a.fileSlug, 10) || 0); });
        return g;
      });
  });
  eleventyConfig.addCollection("picking", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/picking/*.md").sort(function(a, b) {
      return (a.data.order || 0) - (b.data.order || 0);
    });
  });
  eleventyConfig.addCollection("pickingSections", function(collectionApi) {
    var lessons = collectionApi.getFilteredByGlob("src/picking/*.md").sort(function(a, b) {
      return (a.data.order || 0) - (b.data.order || 0);
    });
    var order = [];
    var map = {};
    lessons.forEach(function(l) {
      var s = l.data.section || "Lessons";
      if (!map[s]) { map[s] = { name: s, lessons: [] }; order.push(s); }
      map[s].lessons.push(l);
    });
    return order.map(function(s) { return map[s]; });
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

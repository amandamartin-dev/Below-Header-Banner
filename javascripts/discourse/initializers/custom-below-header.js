import { withPluginApi } from "discourse/lib/plugin-api";
import { ajax } from "discourse/lib/ajax";

export default {
  name: "custom-below-header",
  initialize(container) {
    withPluginApi("0.8", (api) => {
      this.siteSettings = container.lookup("service:site-settings");

      api.onPageChange(() => {
        try {
          const allowedRoutes = settings.display_on_routes
          const currentPath = window.location.pathname;
          const component = document.querySelector(".custom-below-header");

          const now = new Date();
          const startTime = settings.banner_start_datetime ? new Date(settings.banner_start_datetime.replace(" ", "T")) : null;
          const endTime = settings.banner_end_datetime ? new Date(settings.banner_end_datetime.replace(" ", "T")) : null;
      
          const isWithinTimeRange =
            (!startTime || now >= startTime) &&
            (!endTime || now <= endTime);

          if (settings.enable_banner && component && isWithinTimeRange) {
            const shouldDisplay = allowedRoutes.split("|").some((route) => {
              if (route.endsWith("*")) {
                return currentPath.startsWith(route.slice(0, -1));
              }
              return currentPath === route;
            });

            component.style.display = shouldDisplay ? "flex" : "none";
            addEventHandler(component);
            
          } else if (component) {
              component.style.display = "none";
          }
        } catch (error) {
          console.error("Error in custom-below-header:", error);
        }
      });
    });
  },
};

function addEventHandler(component) {
  const bannerLink = component.querySelector("a"); 

  if (bannerLink) {
    bannerLink.addEventListener("click", (event) => {
      event.preventDefault(); 

      const placementID = settings.placement_id; 
      const campaignID = settings.campaign_id; 

      if (!placementID || !campaignID) {
        console.warn("Missing placementID or campaignID on banner click.");
        handleErrorAndStop({
          origin: window.location.origin,
          placementID: placementID,
          campaignID: campaignID,
          message: "Missing placementID or campaignID",
          event,
        });
        return;
      }

      handleBannerClick({ placementID, campaignID }, event);
    });
  }
}

function handleBannerClick(block, event) {
  const apiEndpoint = settings.api_endpoint;
  
  if (!apiEndpoint) {
    handleErrorAndStop({
      origin: window.location.origin,
      placementID: block.placementID,
      campaignID: block.campaignID,
      message: "API endpoint is not configured.",
      event,
    });
    return;
  }

  const payload = {
    placementID: block.placementID,
    campaignID: block.campaignID,
  };

  ajax(apiEndpoint, {
    method: "POST",
    data: payload,
    headers: {
      "Content-Type": "application/json",
      referrer: document.referrer,
    },
  })
    .then((response) => {
      console.log("Block data sent successfully:", response);
      navigateToLink(event);
      return;
    })
    .catch((error) => {
      handleErrorAndStop({
        origin: window.location.origin,
        placementID: block.placementID,
        campaignID: block.campaignID,
        message: error.responseText || error.message || "Unknown error",
        event,
      });
    });
}

function navigateToLink(event) {
  const href = event.target.closest("a")?.getAttribute("href");
  if (href) {
    window.open(href, "_blank");
  }
}

function handleErrorAndStop({ origin, placementID, campaignID, message, event }) {
  console.error("Error encountered:", message);

  const apiKey = settings.api_key;
  const errorCategoryID = settings.category_id;

  if (!apiKey || !errorCategoryID) {
    console.warn("Missing required settings for error topic creation.");
    navigateToLink(event); 
    return;
  }

  const topicTitle = `API Error: Below Header Failure`;
  const topicBody = `
  **Error Details:**
  - **Origin:** ${origin}
  - **Placement ID:** ${placementID} 
  - **Campaign ID:** ${campaignID}
  - **Error Message:** ${message}`;

  ajax("/posts", {
    method: "POST",
    data: {
      title: topicTitle,
      raw: topicBody,
      category: errorCategoryID,
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Api-Key": apiKey,
      "Api-Username": "system",
    },
  })
    .then(() => console.log("Error topic created successfully."))
    .catch((err) => console.error("Failed to create error topic:", err))
    .finally(() => navigateToLink(event)); 
}
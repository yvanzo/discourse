import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { hash } from "rsvp";
import { ajax } from "discourse/lib/ajax";
import PreloadStore from "discourse/lib/preload-store";
import { defaultHomepage } from "discourse/lib/utilities";
import CategoryList from "discourse/models/category-list";
import TopicList from "discourse/models/topic-list";
import DiscourseRoute from "discourse/routes/discourse";
import I18n from "discourse-i18n";

export default class DiscoveryCategoriesRoute extends DiscourseRoute {
  @service modal;
  @service router;
  @service session;

  templateName = "discovery/categories";
  controllerName = "discovery/categories";

  findCategories() {
    let style =
      !this.site.mobileView && this.siteSettings.desktop_category_page_style;

    if (
      style === "categories_and_latest_topics" ||
      style === "categories_and_latest_topics_created_date"
    ) {
      return this._findCategoriesAndTopics("latest");
    } else if (style === "categories_and_top_topics") {
      return this._findCategoriesAndTopics("top");
    } else {
      // The server may have serialized this. Based on the logic above, we don't need it
      // so remove it to avoid it being used later by another TopicList route.
      PreloadStore.remove("topic_list");
    }

    return CategoryList.list(this.store);
  }

  model() {
    return this.findCategories().then((model) => {
      const tracking = this.topicTrackingState;
      if (tracking) {
        tracking.sync(model, "categories");
        tracking.trackIncoming("categories");
      }
      return model;
    });
  }

  _loadBefore(store) {
    const session = this.session;

    return function (topic_ids, storeInSession) {
      // refresh dupes
      this.topics.removeObjects(
        this.topics.filter((topic) => topic_ids.includes(topic.id))
      );

      const url = `/latest.json?topic_ids=${topic_ids.join(",")}`;

      return ajax({ url, data: this.params }).then((result) => {
        const topicIds = new Set();
        this.topics.forEach((topic) => topicIds.add(topic.id));

        let i = 0;
        TopicList.topicsFrom(store, result).forEach((topic) => {
          if (!topicIds.has(topic.id)) {
            topic.set("highlight", true);
            this.topics.insertAt(i, topic);
            i++;
          }
        });

        if (storeInSession) {
          session.set("topicList", this);
        }
      });
    };
  }

  async _findCategoriesAndTopics(filter) {
    let result = await hash({
      categoriesList: PreloadStore.getAndRemove("categories_list"),
      topicsList: PreloadStore.getAndRemove("topic_list"),
    });

    if (result.categoriesList?.category_list && result.topicsList?.topic_list) {
      result = { ...result.categoriesList, ...result.topicsList };
    } else {
      // Otherwise, return the ajax result
      result = await ajax(`/categories_and_${filter}`);
    }

    if (result.topic_list?.top_tags) {
      this.site.set("top_tags", result.topic_list.top_tags);
    }

    return CategoryList.create({
      store: this.store,
      categories: CategoryList.categoriesFrom(this.store, result),
      topics: TopicList.topicsFrom(this.store, result),
      can_create_category: result.category_list.can_create_category,
      can_create_topic: result.category_list.can_create_topic,
      loadBefore: this._loadBefore(this.store),
    });
  }

  titleToken() {
    if (defaultHomepage() === "categories") {
      return;
    }
    return I18n.t("filters.categories.title");
  }

  setupController(controller) {
    controller.setProperties({
      discovery: this.controllerFor("discovery"),
    });

    super.setupController(...arguments);
  }

  @action
  triggerRefresh() {
    this.refresh();
  }
}

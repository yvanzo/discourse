# The most basic attributes of a topic that we need to create a link for it.
class BasicPostSerializer < ApplicationSerializer
  attributes :id,
             :name,
             :username,
             :avatar_template,
             :created_at,
             :cooked,
             :cooked_hidden,
             :ignored

  def name
    object.user && object.user.name
  end

  def username
    object.user && object.user.username
  end

  def avatar_template
    object.user && object.user.avatar_template
  end

  def cooked_hidden
    object.hidden && !scope.is_staff?
  end

  def include_cooked_hidden?
    cooked_hidden
  end

  def cooked
    if cooked_hidden
      if scope.current_user && object.user_id == scope.current_user.id
        I18n.t('flagging.you_must_edit', path: "/my/messages")
      else
        I18n.t('flagging.user_must_edit')
      end
    elsif ignored
      I18n.t('ignored.hidden_content')
    else
      object.filter_quotes(@parent_post)
    end
  end

  def ignored
    object.is_first_post? && IgnoredUser.where(user_id: scope.current_user&.id,
                                               ignored_user_id: object.user_id).present?
  end

  def include_name?
    SiteSetting.enable_names?
  end

end

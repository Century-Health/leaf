using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Mixpanel;

namespace Server.API.Utils
{
    public static class MixpanelLogs
    {
        private static readonly string _token = "80ae490af6882c9cdfa956afabdb181e";
        private static readonly MixpanelClient _client;

        static MixpanelLogs()
        {
            _client = new MixpanelClient(_token);
        }

        public static async Task TrackEventAsync(string eventName, object properties)
        {
            if (string.IsNullOrEmpty(eventName))
                throw new ArgumentNullException(nameof(eventName));
            
            if (properties == null)
                throw new ArgumentNullException(nameof(properties));

            // Convert properties to dictionary
            var eventProperties = new Dictionary<string, object>();
            
            foreach (var prop in properties.GetType().GetProperties())
            {
                var value = prop.GetValue(properties);
                eventProperties[prop.Name] = value;
            }

            await _client.TrackAsync(eventName, eventProperties);
        }
    }
}

using System;
using System.IO;
using System.Text.Json;
using System.Runtime.Serialization.Formatters.Binary;

[Serializable]
public class rshwFile
{
    public byte[] audioData { get; set; }
    public int[] signalData { get; set; }
}

class Program
{
    static int Main(string[] args)
    {
        string wav = null;
        string signals = null;
        string outp = null;
        for (int i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--wav": wav = args[++i]; break;
                case "--signals": signals = args[++i]; break;
                case "--out": outp = args[++i]; break;
            }
        }
        if (wav == null || signals == null || outp == null)
        {
            Console.Error.WriteLine("Usage: rshw_serializer --wav <input.wav> --signals <signals.json> --out <output.rshw>");
            return 2;
        }

        if (!File.Exists(wav)) { Console.Error.WriteLine($"Missing wav: {wav}"); return 3; }
        if (!File.Exists(signals)) { Console.Error.WriteLine($"Missing signals: {signals}"); return 4; }

        try
        {
            var audioBytes = File.ReadAllBytes(wav);
            var sigJson = File.ReadAllText(signals);
            var sigArr = JsonSerializer.Deserialize<int[]>(sigJson);

            var obj = new rshwFile { audioData = audioBytes, signalData = sigArr };

            using (var fs = File.Open(outp, FileMode.Create, FileAccess.Write))
            {
                var bf = new BinaryFormatter();
                bf.Serialize(fs, obj);
            }
            Console.WriteLine($"Wrote {outp}");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Error: " + ex.ToString());
            return 1;
        }
    }
}
